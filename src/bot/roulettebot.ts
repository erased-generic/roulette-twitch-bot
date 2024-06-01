export { BetCommand, RouletteBot };

import * as rouletteModule from '../util/roulette';
import * as userDataModule from '../util/userdata';
import { Bot, ChatContext } from '../util/interfaces';
import { BotBase, PerUserData } from './botbase';

interface BetCommand {
  betNumbers: number[];
  betName: string;
  amount: number;
}

class RouletteBot extends BotBase implements Bot {
  readonly handlers: { [key: string]: (context: ChatContext, args: string[]) => string | undefined } = {
    "bet": this.betHandler.bind(this),
    "unbet": this.unbetHandler.bind(this),
    "roulette": this.rouletteHandler.bind(this),
    "balance": this.pointsHandler.bind(this),
    "claim": this.claimHandler.bind(this),
    "leaderboard": this.leaderboardHandler.bind(this),
  };
  static readonly N_PLACES = 37;
  static readonly ALL_PLACES = rouletteModule.RouletteBase.getAllNumbers(RouletteBot.N_PLACES);

  readonly roulette = new rouletteModule.Roulette(RouletteBot.N_PLACES);

  constructor(userData: userDataModule.UserData<PerUserData>) {
    super(userData);
  }

  onHandlerCalled(context: ChatContext, args: string[]): void {}

  static parseBetCommand(tokens: string[]): BetCommand | string {
    let betNumbers: number[] = [], amount: number;

    {
      const parsed = RouletteBot.parseAmount(tokens[1]);
      if (typeof parsed === 'string') {
        return parsed;
      }
      amount = parsed;
    }

    if (tokens.length < 3) {
      return "too few arguments";
    }
    const parseSpaceRanges = (start: number): number[] | string => {
      const res: number[] = [];
      for (let i = 0; i < tokens.length - start; i++) {
        const values = BotBase.parseSpaceRange(tokens[start + i], RouletteBot.ALL_PLACES);
        if (typeof values === 'string') {
          return values;
        }
        res.push(...values);
      }
      return res;
    };

    let betName: string;
    const betType = tokens[2].toLowerCase();
    betName = betType;
    const allNumbers = RouletteBot.ALL_PLACES;
    switch (betType) {
      case "red":
        betNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        break;
      case "black":
        betNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
        break;
      case "green":
        betNumbers = [0];
        break;
      case "column1":
        betNumbers = allNumbers.filter(x => x % 3 === 1);
        break;
      case "column2":
        betNumbers = allNumbers.filter(x => x % 3 === 2);
        break;
      case "column3":
        betNumbers = allNumbers.filter(x => x % 3 === 0 && x !== 0);
        break;
      case "dozen1":
        betNumbers = allNumbers.filter(x => x >= 1 && x <= 12);
        break;
      case "dozen2":
        betNumbers = allNumbers.filter(x => x >= 13 && x <= 24);
        break;
      case "dozen3":
        betNumbers = allNumbers.filter(x => x >= 25 && x <= 36);
        break;
      case "odd":
        betNumbers = allNumbers.filter(x => x % 2 === 1);
        break;
      case "even":
        betNumbers = allNumbers.filter(x => x % 2 === 0 && x !== 0);
        break;
      case "1to18":
        betNumbers = allNumbers.filter(x => x >= 1 && x <= 18);
        break;
      case "19to36":
        betNumbers = allNumbers.filter(x => x >= 19 && x <= 36);
        break;
      case "all":
        betNumbers = allNumbers.filter(x => x > 0);
        break;
      case "all0":
        betNumbers = allNumbers;
        break;
      default: {
        let parsed = parseSpaceRanges(2);
        if (typeof parsed === 'string') {
          return parsed;
        }
        parsed = Array.from(new Set(parsed)).sort((a, b) => a - b);
        betNumbers = parsed;
        betName = parsed.length === 1 ? parsed[0].toString() : "custom bet";
      }
    }

    return { betNumbers, betName, amount };
  }

  betHandler(context: ChatContext, args: string[]): string | undefined {
    // Place a bet
    const userId = context['user-id'];
    const betCommand = RouletteBot.parseBetCommand(args);
    if (typeof betCommand === 'string') {
      return `Parse error: ${betCommand}, try !bet <points> <outcome...>, ${context['username']}!`;
    }
    const amount = this.bet(this.roulette, userId, betCommand.amount, betCommand.betNumbers);
    if (typeof amount === 'string') {
      return amount;
    }
    console.log(`* bet ${userId}, ${betCommand.amount}, ${betCommand.betNumbers}`);
    return `${context.username} placed a bet of ${amount} on ${betCommand.betName}!`;
  }

  unbetHandler(context: ChatContext, args: string[]): string | undefined {
    // Remove a bet
    const userId = context['user-id'];
    this.unbet(this.roulette, userId);
    return `${context.username} is not betting anymore!`;
  }

  rouletteHandler(context: ChatContext, args: string[]): string | undefined {
    let msg = "";
    this.roulette.runRoulette();
    // Run the roulette
    msg += `Ball landed on: ${this.roulette.lastNumber}`;
    const callback = this.createWinningsCallback((username: string | undefined, didWin: boolean, delta: number, chance: number, balance: number) => {
      const percent = Math.round(chance * 100);
      if (didWin) {
        return `${username} won ${delta} points with a chance of ${percent}% and now has ${balance} points`;
      } else {
        return `${username} lost ${-delta} points with a chance of ${100 - percent}% and now has ${balance} points`;
      }
    });
    this.roulette.computeWinnings((playerId: string, didWin: boolean, chance: number, amount: number, payout: number) => {
      msg += ", " + callback(playerId, didWin, chance, amount, payout);
    });
    return msg;
  }

  pointsHandler(context: ChatContext, args: string[]): string | undefined {
    // Print the user's points
    const userId = context['user-id'];
    const info = this.userData.get(userId);

    let msg = `You have ${info.balance} points`;
    if (info.reservedBalance > 0) {
      msg += ` (currently betted ${info.reservedBalance} of those)`
    }
    return msg + `, ${context['username']}!`;
  }

  claimHandler(context: ChatContext, args: string[]): string | undefined {
    // Claim 100 points per 30 minutes
    const claimSize = 100;
    const minute = 1000 * 60;
    const hour = minute * 60;
    const day = hour * 24;
    const claimCooldown = 30 * minute;

    const userId = context['user-id'];

    const lastClaim = this.userData.get(userId).lastClaim;
    const now = Date.now();
    if (lastClaim !== undefined) {
      const elapsed = now - lastClaim;
      if (elapsed < claimCooldown) {
        let msg = `You are on cooldown, ${context['username']}! Please wait for `;
        const eta = claimCooldown - elapsed;
        if (eta < minute * 1.5) {
          msg += `a minute`;
        } else if (eta < hour) {
          msg += `${Math.round(eta / minute)} minutes`;
        } else {
          msg += `${Math.round(eta / hour)} hours`;
        }
        return msg;
      }
    }
    let balance = 0;
    this.userData.update(userId, (inPlaceValue, hadKey) => { inPlaceValue.lastClaim = now; balance = inPlaceValue.balance += claimSize; });
    return `You claimed ${claimSize} points and now have ${balance} points, ${context['username']}!`;
  }

  leaderboardHandler(context: ChatContext, args: string[]): string | undefined {
    let boardSize = 3;
    if (args.length > 1) {
      boardSize = parseInt(args[1]);
      if (isNaN(boardSize)) {
        return `Parse error: ${args[1]}, try !leaderboard [<size>], ${context['username']}!`;
      }
    }
    return `Top ${boardSize} richest people in our chat: ` + Object
      .entries(this.userData.getAll())
      .map(([id, data]) => { return { username: data.username, balance: data.balance }; })
      .sort((a, b) => b.balance - a.balance)
      .slice(0, boardSize)
      .map(a => `${a.username} with ${a.balance} points`)
      .join(", ") + ".";
  }
}
