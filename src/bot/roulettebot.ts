export { BetCommand, RouletteBot };

import * as rouletteModule from '../util/roulette';
import { UserData } from '../util/userdata';
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
  };
  static readonly N_PLACES = 37;
  static readonly ALL_PLACES = rouletteModule.RouletteBase.getAllNumbers(RouletteBot.N_PLACES);

  readonly roulette = new rouletteModule.Roulette(RouletteBot.N_PLACES);

  constructor(userData: UserData<PerUserData>) {
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
    console.log(`* bet: ${userId}, ${context.username}, ${betCommand.amount}, ${betCommand.betNumbers}`);
    return `${context.username} placed a bet of ${amount} on ${betCommand.betName}!`;
  }

  unbetHandler(context: ChatContext, args: string[]): string | undefined {
    // Remove a bet
    const userId = context['user-id'];
    this.unbet(this.roulette, userId);
    console.log(`* unbet: ${userId}, ${context.username}`);
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
      console.log(`* roulette: ${playerId}, ${this.getUsername(playerId)}, ${payout}`);
      msg += ", " + callback(playerId, didWin, chance, amount, payout);
    });
    return msg;
  }
}
