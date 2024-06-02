export { DuelCommand, DuelBot };

import * as rouletteModule from '../util/roulette';
import * as blackjackModule from '../util/blackjack';
import * as userDataModule from '../util/userdata';
import { Bot, ChatContext } from '../util/interfaces';
import { BotBase, PerUserData } from './botbase';

class DuelRendezvous {
  userId1: string;
  username2: string;
  amount: number;

  constructor(userId1: string, username2: string, amount: number) {
    this.userId1 = userId1;
    this.username2 = username2;
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

interface DuelCommand {
  amount: number;
  username: string;
}

class DuelBot extends BotBase implements Bot {
  readonly handlers: { [key: string]: (context: ChatContext, args: string[]) => string | undefined } = {
    "duel": this.duelHandler.bind(this),
    "accept": this.acceptHandler.bind(this),
    "hit": this.hitHandler.bind(this),
    "stand": this.standHandler.bind(this),
    "unduel": this.unduelHandler.bind(this),
    "rendezvous": this.rendezvousHandler.bind(this),
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
    userData: userDataModule.UserData<PerUserData>,
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
      return `Parse error: ${duelCommand}, try !duel <amount> <username>, ${context['username']}!`;
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
    console.log(`* rendezvous ${userId1}, ${username2}, ${amount}`);
    return `${username2}, reply with !accept [${context['username']}] to accept the duel, if you're ready to bet ${amount} points!`;
  }

  private unrendezvous(duel: DuelRendezvous) {
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
      console.log(`* tie: ${this.getUsername(result.ranking[0][0])} (${duel.userId1}) vs ` +
        `${this.getUsername(result.ranking[0][1])} (${duel.userId2})`);
      return msg;
    } else {
      const winnerId = result.ranking[0][0];
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
        msg += ", " + callback(playerId, didWin, chance, amount, payout);
      });
      console.log(`* won: ${this.getUsername(winnerId)} (${winnerId})`);
      return msg;
    }
  }

  unduelHandler(context: ChatContext, args: string[]): string | undefined {
    const userId = context['user-id'];
    const duel = this.duels[userId];
    let msg = ``;
    if (duel instanceof DuelAccepted) {
      let ranking = [[duel.userId1], [duel.userId2]];
      if (userId === duel.userId1) {
        ranking.reverse();
      }
      return `${context['username']}, you forfeit the duel. ` + this.processDuelResult(duel, { ranking });
    } else if (duel !== undefined) {
      this.unrendezvous(duel);
    }
    return `${context['username']} retracted all their duel requests`;
  }

  private printDuelStatus(duel: DuelAccepted, result?: blackjackModule.GameResult): string {
    if (result !== undefined) {
      return this.processDuelResult(duel, result);
    }

    return `${this.getUsername(duel.blackjack.getCurrentPlayer())}, your move! Type !hit or !stand!`;
  }

  acceptHandler(context: ChatContext, args: string[]): string | undefined {
    const userId2 = context['user-id'];
    const username2 = context['username'];
    if (userId2 in this.duels && this.duels[userId2] instanceof DuelAccepted) {
      return `${username2}, you already have a duel in progress with ${this.duels[userId2].username2}!`;
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
    console.log(`* duel: ${this.getUsername(accepted.userId1)} (${accepted.userId1}) with ${accepted.amount} vs ` +
      `${rendezvous.username2} (${userId2}) with ${amount2}`);

    msg += `Let the blackjack duel begin! `;
    for (const userId of players) {
      msg +=
        `${this.getUsername(userId)}'s hand: ${accepted.blackjack.hands[userId].toString()}` +
        `, totaling ${blackjackModule.BlackJack.getBalance(accepted.blackjack.hands[userId])}. `;
    }

    return msg + this.printDuelStatus(accepted, accepted.blackjack.init());
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
    console.log(`* hit: ${username} - ${duel.blackjack.hands[userId].toString()} (${result.balance})`);
    return msg + this.printDuelStatus(duel, result.result);
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
    console.log(`* stand: ${username} - ${duel.blackjack.hands[userId].toString()} (${result.balance})`);
    return this.printDuelStatus(duel, result.result);
  }

  rendezvousHandler(context: ChatContext, args: string[]): string | undefined {
    const userId = context['user-id'];
    const username = context['username'];
    let msg = `${username}, you are participating in: `;
    let isFirst = true;
    for (const duel of Object.values(this.duels)) {
      if (duel.userId1 === userId || duel.username2 === username) {
        if (isFirst) {
          isFirst = false;
        } else {
          msg += ", ";
        }
        if (duel instanceof DuelAccepted) {
          msg += `an ongoing duel ${this.userData.get(duel.userId1).username} <-> ${duel.username2}`;
        } else {
          msg += `a duel request ${this.userData.get(duel.userId1).username} -> ${duel.username2}`;
        }
      }
    }
    if (isFirst) {
      msg += "nothing.";
    }
    return msg;
  }
}
