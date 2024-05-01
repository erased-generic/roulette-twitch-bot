export { BetCommand, RouletteBot };

import * as rouletteModule from './roulette';
import * as userDataModule from './userdata';
import { Bot, ChatContext } from './interfaces';

interface PerUserData {
  balance: number
}

interface BetCommand {
  betNumbers: number[];
  betName: string;
  amount: number;
}

class RouletteBot implements Bot {
  readonly handlers: { [key: string]: (context: ChatContext, args: string[]) => string | undefined } = {
    "bet": this.betHandler.bind(this),
    "unbet": this.unbetHandler.bind(this),
    "roulette": this.rouletteHandler.bind(this),
    "points": this.pointsHandler.bind(this),
  };
  readonly roulette = new rouletteModule.Roulette();
  readonly usernames: { [key: string]: string | undefined } = {};
  readonly userData = new userDataModule.UserData<PerUserData>({ balance: 100 }, "data/table.json");

  static parseBetCommand(tokens: string[]): BetCommand | string {
    let betNumbers: number[] = [], amount: number;

    amount = parseInt(tokens[1]);
    if (isNaN(amount)) {
      return "amount must be a number";
    }

    if (tokens.length < 3) {
      return "too few arguments";
    }
    const parseInts = (start: number, n: number): number[] | string => {
      const res: number[] = [];
      for (let i = 0; i < n; i++) {
        const value = parseInt(tokens[start + i]);
        if (isNaN(value)) {
          return "invalid space";
        }
        if (!rouletteModule.Roulette.allNumbers.includes(value)) {
          return "invalid space number";
        }
        res.push(value);
      }
      return res;
    };
    const toRow = (space: number): number => {
      return Math.floor((space - 1) / 3);
    };
    const toCol = (space: number): number => {
      return (space - 1) % 3;
    };
    const parseListBet = (name: string, n: number, acceptsZero: boolean, pred: (parsed: number[]) => undefined | string): undefined | string => {
      if (tokens.length < 3 + n) {
        return `${name} bet requires ${n} spaces`;
      }
      const parsed = parseInts(3, n);
      if (typeof parsed === 'string') {
        return parsed;
      }
      if (!acceptsZero && parsed.includes(0)) {
        return `${name} bet doesn't accept zero`;
      }
      parsed.sort();
      const res = pred(parsed);
      if (typeof res === 'string') {
        return `${name} bet requires ${res}`;
      }
      betNumbers = parsed;
      return undefined;
    };
    const parseListBetNoZero = (name: string, n: number, pred: (parsed: number[]) => undefined | string): undefined | string => {
      return parseListBet(name, n, false, pred);
    };

    const betNumber = parseInt(tokens[2]);
    let betName: string;
    const betType = tokens[2].toLowerCase();
    betName = betType;
    const allNumbers = rouletteModule.Roulette.allNumbers;
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
      case "split": {
        const res = parseListBetNoZero(betType, 2, parsed =>
          (toRow(parsed[1]) === toRow(parsed[0]) && parsed[1] === parsed[0] + 1 ||
            toRow(parsed[1]) === toRow(parsed[0]) + 1 && toCol(parsed[1]) === toCol(parsed[0]))
            ? undefined
            : "two adjoining numbers");
        if (res !== undefined) {
          return res;
        }
        break;
      }
      case "street": {
        const res = parseListBetNoZero(betType, 3, parsed =>
          (toRow(parsed[2]) === toRow(parsed[1]) && toRow(parsed[1]) === toRow(parsed[0]) &&
            parsed[2] === parsed[1] + 1 && parsed[1] === parsed[0] + 1)
            ? undefined
            : "three horizontally adjoining numbers");
        if (res !== undefined) {
          return res;
        }
        break;
      }
      case "corner": {
        const res = parseListBetNoZero(betType, 4, parsed =>
          (toRow(parsed[1]) === toRow(parsed[0]) &&
            toRow(parsed[3]) === toRow(parsed[2]) &&
            toRow(parsed[2]) === toRow(parsed[0]) + 1 &&
            toCol(parsed[2]) === toCol(parsed[0]) &&
            parsed[1] === parsed[0] + 1 &&
            parsed[3] === parsed[2] + 1)
            ? undefined
            : "four adjoining numbers in a block");
        if (res !== undefined) {
          return res;
        }
        break;
      }
      case "doublestreet": {
        const res = parseListBetNoZero(betType, 6, parsed =>
          (toRow(parsed[2]) === toRow(parsed[1]) && toRow(parsed[1]) === toRow(parsed[0]) &&
            toRow(parsed[5]) === toRow(parsed[4]) && toRow(parsed[4]) === toRow(parsed[3]) &&
            toRow(parsed[3]) === toRow(parsed[0]) + 1 &&
            parsed[2] === parsed[1] + 1 && parsed[1] === parsed[0] + 1 &&
            parsed[5] === parsed[4] + 1 && parsed[4] === parsed[3] + 1)
            ? undefined
            : "two adjoining rows of numbers");
        if (res !== undefined) {
          return res;
        }
        break;
      }
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
      default: {
        const parsed = parseInts(2, 1);
        if (typeof parsed === 'string') {
          return `unrecognized bet: ${parsed}`;
        }
        betNumbers = parsed;
        betName = betNumber.toString();
      }
    }

    return { betNumbers, betName, amount };
  }

  betHandler(context: ChatContext, args: string[]): string | undefined {
    // Place a bet
    const userId = context['user-id'];

    const betCommand = RouletteBot.parseBetCommand(args);
    if (typeof betCommand === 'string') {
      return `Parse error: ${betCommand}, try !bet <what> <where>, ${context['username']}!`;
    }
    console.log(`${userId}, ${betCommand.amount}, ${betCommand.betNumbers}`)
    this.usernames[userId] = context['username']
    if (betCommand.amount <= 0) {
      return `You can bet only a positive amount of points, ${context['username']}!`;
    }
    if (betCommand.amount > this.userData.get(userId).balance) {
      return `You don't have that many points, ${context['username']}!`;
    }
    this.roulette.placeBet(userId, betCommand.amount, betCommand.betNumbers);
    return `${context.username} placed a bet of ${betCommand.amount} on ${betCommand.betName}!`;
  }

  unbetHandler(context: ChatContext, args: string[]): string | undefined {
    // Remove a bet
    const userId = context['user-id'];

    this.roulette.unplaceBet(userId);
    return `${context.username} is not betting anymore!`;
  }

  rouletteHandler(context: ChatContext, args: string[]): string | undefined {
    // Run the roulette
    let msg = `Ball landed on: ${this.roulette.runRoulette()}`;
    this.roulette.computeWinnings((playerId: string, didWin: boolean, chance: number, payout: number, amount: number) => {
      msg += ", "
      if (didWin) {
        const won = payout * amount;
        msg += `${this.usernames[playerId]} won ${won} points with a chance of ${Math.floor(chance * 100)}%`;
        this.userData.update(playerId, (inPlaceValue, hadKey) => { inPlaceValue.balance += won; });
      } else {
        msg += `${this.usernames[playerId]} lost ${amount} points with a chance of ${Math.floor((1 - chance) * 100)}%`;
        this.userData.update(playerId, (inPlaceValue, hadKey) => { inPlaceValue.balance -= amount; });
      }
    });
    return msg;
  }

  pointsHandler(context: ChatContext, args: string[]): string | undefined {
    // Print the user's points
    const userId = context['user-id'];

    let msg = `You have ${this.userData.get(userId).balance} points`;
    const bet = this.roulette.getBet(userId);
    if (bet !== undefined) {
      msg += ` (currently betted ${bet} of those)`
    }
    return msg + `, ${context['username']}!`;
  }
}
