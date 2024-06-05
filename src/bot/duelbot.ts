export { DuelCommand, DuelBot };

import * as rouletteModule from '../util/roulette';
import * as blackjackModule from '../util/blackjack';
import { UserData } from '../util/userdata';
import { Bot, BotHandler, ChatContext } from '../util/interfaces';
import { BotBase, PerUserData } from './botbase';

class DuelRendezvous {
  userId1: string;
  username2: string;
  amount: number;

  constructor(userId1: string, username2: string, amount: number) {
    this.userId1 = userId1;
    this.username2 = formatUsername(username2);
    this.amount = amount;
  }
}

class DuelAccepted extends DuelRendezvous {
  userId2: string;
  prediction: rouletteModule.Prediction;
  blackjack: blackjackModule.BlackJack;

  constructor(userId1: string, username2: string, amount: number = 0, userId2: string, prediction: rouletteModule.Prediction, blackjack: blackjackModule.BlackJack) {
    super(userId1, username2, amount);
    this.userId2 = userId2;
    this.prediction = prediction;
    this.blackjack = blackjack;
  }
}

function formatUsername(input: string) {
  if (input.startsWith('@')) {
    input = input.substring(1);
  }
  return input.toLowerCase();
}

interface DuelCommand {
  amount: number;
  username: string;
}

class DuelBot extends BotBase implements Bot {
  readonly handlers: { [key: string]: BotHandler } = {
    "duel": {
      action: this.duelHandler.bind(this),
      description: "Request a blackjack duel with another user (they still need to accept it). " +
        "Multiple concurrent duels are supported",
      format: "<amount of points> <opponent username>"
    },
    "accept": {
      action: this.acceptHandler.bind(this),
      description: "Accept a blackjack duel request from another user. If you don't have enough points, you go all-in",
      format: "[<opponent username>]"
    },
    "hit": {
      action: this.hitHandler.bind(this),
      description: "Blackjack duel interface. Pull a card",
      format: ""
    },
    "stand": {
      action: this.standHandler.bind(this),
      description: "Blackjack duel interface. Stand and end your turn",
      format: ""
    },
    "unduel": {
      action: this.unduelHandler.bind(this),
      description: "Retract all your blackjack dueling requests and forfeit any ongoing duels",
      format: ""
    },
    "rendezvous": {
      action: this.rendezvousHandler.bind(this),
      description: "View all ongoing blackjack duels and duel requests",
      format: ""
    },
    "check": {
      action: this.checkHandler.bind(this),
      description: "View your current duel status",
      format: ""
    }
  };

  readonly duels: { [key: string]: DuelRendezvous } = {};
  readonly deckGenerator: () => blackjackModule.Deck
  readonly playerShuffleChance: number;

  static shuffledDeckGenerator(): blackjackModule.Deck {
    const deck = new blackjackModule.Deck();
    deck.shuffle();
    return deck;
  }

  constructor(
    userData: UserData<PerUserData>,
    deckGenerator: () => blackjackModule.Deck = DuelBot.shuffledDeckGenerator,
    playerShuffleChance: number = 0.5
  ) {
    super(userData);
    this.deckGenerator = deckGenerator;
    this.playerShuffleChance = playerShuffleChance;
  }

  onHandlerCalled(context: ChatContext, args: string[]): void {}

  static parseDuelCommand(args: string[]): DuelCommand | string {
    if (args.length < 3) {
      return "too few arguments";
    }
    if (args.length > 3) {
      return "too many arguments";
    }
    const amount = BotBase.parseAmount(args[1]);
    if (typeof amount === 'string') {
      return amount;
    }
    return { amount, username: args[2] };
  }

  duelHandler(context: ChatContext, args: string[]): string | undefined {
    const duelCommand = DuelBot.parseDuelCommand(args);
    if (typeof duelCommand === 'string') {
      return `Parse error: ${duelCommand}, try %{format}, ${context['username']}!`;
    }
    const userId1 = context['user-id'];
    if (this.duels[userId1] instanceof DuelAccepted) {
      return `Duel already in progress, ${context['username']}!`;
    }
    const amount = this.ensureBalance(userId1, duelCommand.amount, this.duels[userId1]?.amount);
    if (typeof amount === 'string') {
      return amount;
    }

    const username2 = duelCommand.username;
    this.duels[userId1] = new DuelRendezvous(userId1, username2, amount);
    console.log(`* rendezvous: ${userId1} ${this.getUsername(userId1)}, ${username2}, ${amount}`);
    return `${username2}, reply with !accept [${context['username']}] to accept the blackjack duel, if you're ready to bet ${amount} points!`;
  }

  private unrendezvous(duel: DuelRendezvous) {
    console.log(`* unrendezvous: ${duel.userId1} ${this.getUsername(duel.userId1)}, ${duel.username2}, ${duel.amount}`);
    this.reserveBalance(duel.userId1, -duel.amount);
    delete this.duels[duel.userId1];
  }

  private processDuelResult(duel: DuelAccepted, result: blackjackModule.GameResult) {
    delete this.duels[duel.userId1];
    delete this.duels[duel.userId2];

    let msg = ``;
    if (result.ranking.length === 1) {
      msg += `It's a tie! All points return to their respective owners.`;
      this.unbetAll(duel.prediction);
      console.log(`* tie: ${result.ranking[0][0]} ${this.getUsername(result.ranking[0][0])} vs ` +
        `${result.ranking[0][1]} ${this.getUsername(result.ranking[0][1])}`);
      return msg;
    } else {
      const winnerId = result.ranking[0][0];
      const loserId = result.ranking[1][0];
      msg += `The winner is ${this.getUsername(result.ranking[0][0])}`;
      const callback = this.createWinningsCallback((username: string | undefined, didWin: boolean, delta: number, chance: number, balance: number) => {
        if (didWin) {
          return `${username} won ${delta} points and now has ${balance} points`;
        } else {
          return `${username} lost ${-delta} points and now has ${balance} points`;
        }
      });
      duel.prediction.lastNumber = winnerId === duel.userId1 ? 0 : 1;
      duel.prediction.computeWinnings((playerId: string, didWin: boolean, chance: number, amount: number, payout: number) => {
        console.log(`* blackjack: ${playerId}, ${this.getUsername(playerId)}, ${payout}`);
        msg += ", " + callback(playerId, didWin, chance, amount, payout);
      });
      console.log(`* won: ${winnerId} ${this.getUsername(winnerId)} against ${loserId} ${this.getUsername(loserId)}`);
      return msg;
    }
  }

  unduelHandler(context: ChatContext, args: string[]): string | undefined {
    const userId = context['user-id'];
    const duel = this.duels[userId];
    if (duel instanceof DuelAccepted) {
      let ranking = [[duel.userId1], [duel.userId2]];
      if (userId === duel.userId1) {
        ranking.reverse();
      }
      console.log(`* forfeit: ${userId}, ${this.getUsername(userId)}`);
      return `${context['username']}, you forfeit the duel. ` + this.processDuelResult(duel, { ranking });
    } else if (duel !== undefined) {
      this.unrendezvous(duel);
    }
    return `${context['username']} retracted all their duel requests`;
  }

  private printDuelStatus(duel: DuelAccepted, moreInfo: boolean, result?: blackjackModule.GameResult): string {
    let msg = ``;
    if (moreInfo) {
      const players = [duel.userId1, duel.userId2];
      for (const userId of players) {
        msg +=
          `${this.getUsername(userId)}'s hand: ${duel.blackjack.hands[userId].toString()}` +
          `, totaling ${blackjackModule.BlackJack.getBalance(duel.blackjack.hands[userId])}. `;
      }
    }

    if (result !== undefined) {
      return msg + this.processDuelResult(duel, result);
    }

    return msg + `${this.getUsername(duel.blackjack.getCurrentPlayer())}, your move! Type !hit or !stand!`;
  }

  checkHandler(context: ChatContext, args: string[]): string | undefined {
    const userId = context['user-id'];
    const duel = this.duels[userId];
    if (duel instanceof DuelAccepted) {
      return this.printDuelStatus(duel, true);
    }
    return `${context['username']}, you're not in a duel!`;
  }

  acceptHandler(context: ChatContext, args: string[]): string | undefined {
    const userId2 = context['user-id'];
    const username2 = context['username'];
    if (userId2 in this.duels && this.duels[userId2] instanceof DuelAccepted) {
      const otherUsername = this.duels[userId2].username2 === username2
        ? this.getUsername(this.duels[userId2].userId1)
        : this.duels[userId2].username2;
      return `${username2}, you already have a duel in progress with ${otherUsername}!`;
    }

    // Find our rendezvous
    const username1 = args.length < 2 ? undefined : args[1];
    let rendezvous: DuelRendezvous | undefined;
    for (const duel of Object.values(this.duels)) {
      const duelUsername1 = this.getUsername(duel.userId1);
      if (!(duel instanceof DuelAccepted) &&
          (username1 === undefined || duelUsername1 === username1) &&
          duel.username2 === username2) {
        // found!
        if (rendezvous !== undefined) {
          // ambiguous
          return `${username2}, please specify your opponent!`;
        }
        rendezvous = duel;
      } else if (duel.userId1 === userId2) {
        // cancel our request and reclaim the points
        this.unrendezvous(duel);
      }
    }
    if (rendezvous === undefined) {
      // didn't find.
      if (username1 === undefined) {
        // no username, just say that no request exists
        return `${username2}, no one requested a duel with you!`;
      }
      // maybe the target is duelling someone else
      if (this.duels[username1] instanceof DuelAccepted) {
        return `${username2}, ${username1} is busy!`;
      }
      // nope, no request at all
      return `${username2}, ${username1} didn't request a duel with you!`;
    }

    let msg = ``;
    // just go all-in, if we don't have enough points
    const balance2 = this.getBalance(userId2);
    let amount2 = rendezvous.amount;
    if (amount2 >= balance2) {
      amount2 = balance2;
      msg += `${username2} is going all-in with ${amount2} points! `;
    }
    this.reserveBalance(userId2, amount2);
    const prediction = new rouletteModule.Prediction(2);
    if (rendezvous.userId1 === userId2) {
      // hack for testing, just add the bets
      prediction.placeBet(userId2, rendezvous.amount + amount2, [0, 1]);
    } else {
      // userUd1 -> 0, userId2 -> 1
      prediction.placeBet(rendezvous.userId1, rendezvous.amount, [0]);
      prediction.placeBet(userId2, amount2, [1]);
    }

    const players = [rendezvous.userId1, userId2];
    // randomize who goes first
    if (Math.random() < this.playerShuffleChance) {
      players.reverse();
    }
    const accepted = new DuelAccepted(
      rendezvous.userId1,
      rendezvous.username2,
      rendezvous.amount,
      userId2,
      prediction,
      new blackjackModule.BlackJack(players, this.deckGenerator())
    );

    // this.duels[rendezvous.userId1] is the rendezvous, no need to reclaim points
    this.duels[rendezvous.userId1] = accepted;
    // this.duels[userId2] was checked in the precondition or cleared during the search
    // => no need to reclaim points
    this.duels[userId2] = accepted;
    console.log(`* duel: ${accepted.userId1} ${this.getUsername(accepted.userId1)} with ${accepted.amount} vs ` +
      `${userId2} ${rendezvous.username2} with ${amount2}`);

    msg += `Let the blackjack duel begin! If twitch blocks you from sending identical messages, ` +
      `you can put random garbage at the end of the message, like "!hit 123". `;
    return msg + this.printDuelStatus(accepted, true, accepted.blackjack.init());
  }

  hitHandler(context: ChatContext, args: string[]): string | undefined {
    const userId = context['user-id'];
    const username = context['username'];
    const duel = this.duels[userId];
    if (!(duel instanceof DuelAccepted)) {
      return `${username}, you're not in a duel!`;
    }
    const blackjack = duel.blackjack;
    if (blackjack.getCurrentPlayer() !== userId) {
      return `${username}, it's not your turn!`;
    }
    const result = blackjack.hit();
    let msg = `${username}, you pulled a ${result.card.toString()}, totaling ${result.balance}`;
    if (blackjackModule.BlackJack.isBust(result.balance)) {
      msg += ` - you busted`;
    } else if (blackjackModule.BlackJack.is21(result.balance)) {
      msg += ` - you got 21`;
    }
    msg += `! `;
    console.log(`* hit: ${userId} ${username} - ${duel.blackjack.hands[userId].toString()} (${result.balance})`);
    return msg + this.printDuelStatus(duel, false, result.result);
  }

  standHandler(context: ChatContext, args: string[]): string | undefined {
    const userId = context['user-id'];
    const username = context['username'];
    const duel = this.duels[userId];
    if (!(duel instanceof DuelAccepted)) {
      return `${username}, you're not in a duel!`;
    }
    const blackjack = duel.blackjack;
    if (blackjack.getCurrentPlayer() !== userId) {
      return `${username}, it's not your turn!`;
    }
    const result = blackjack.stand();
    console.log(`* stand: ${userId} ${username} - ${duel.blackjack.hands[userId].toString()} (${result.balance})`);
    return `${username} stands with ${result.balance}. ` + this.printDuelStatus(duel, false, result.result);
  }

  rendezvousHandler(context: ChatContext, args: string[]): string | undefined {
    const userId = context['user-id'];
    const username = context['username'];
    let msg = `${username}, you are participating in: `;
    let metAccepted = false;
    let msgs = [];
    for (const duel of Object.values(this.duels)) {
      if (duel.userId1 === userId || duel.username2 === username) {
        if (duel instanceof DuelAccepted) {
          if (!metAccepted) {
            msgs.push(`an ongoing duel ${this.userData.get(duel.userId1).username} <-> ${duel.username2}`);
            metAccepted = true;
          }
        } else {
          msgs.push(`a duel request ${this.userData.get(duel.userId1).username} -> ${duel.username2}`);
        }
      }
    }
    if (msgs.length === 0) {
      msg += "no blackjack duels or duel requests.";
    } else {
      msg += msgs.join(", ");
    }
    return msg;
  }
}
