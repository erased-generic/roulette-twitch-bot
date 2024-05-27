export { BetCommand, RouletteBot };

import * as rouletteModule from './roulette';
import * as userDataModule from './userdata';
import { Bot, ChatContext } from './interfaces';

interface PerUserData {
  username?: string;
  balance: number;
  lastClaim?: number;
}

interface BetCommand {
  betNumbers: number[];
  betName: string;
  amount: number;
}

interface PredictCommand {
  predictNumber: number;
  amount: number;
}

class RouletteBot implements Bot {
  readonly handlers: { [key: string]: (context: ChatContext, args: string[]) => string | undefined } = {
    "bet": this.betHandler.bind(this),
    "unbet": this.unbetHandler.bind(this),
    "roulette": this.rouletteHandler.bind(this),
    "balance": this.pointsHandler.bind(this),
    "claim": this.claimHandler.bind(this),
    "leaderboard": this.leaderboardHandler.bind(this),
    "predict": this.predictHandler.bind(this),
    "unpredict": this.unpredictHandler.bind(this),
    "open": this.openPredictionHandler.bind(this),
    "status": this.predictStatusHandler.bind(this),
    "close": this.closePredictionHandler.bind(this),
    "refund": this.refundHandler.bind(this),
    "outcome": this.outcomeHandler.bind(this)
  };
  static readonly N_PLACES = 37;
  static readonly ALL_PLACES = rouletteModule.RouletteBase.getAllNumbers(RouletteBot.N_PLACES);
  readonly roulette = new rouletteModule.Roulette(RouletteBot.N_PLACES);
  readonly prediction = new rouletteModule.Prediction(RouletteBot.N_PLACES);
  readonly userData = new userDataModule.UserData<PerUserData>({ username: undefined, balance: 100, lastClaim: undefined }, "data/table.json");
  predictionOpen = false;

  static parseSpaceRange(arg: string): number[] | string {
    if (arg.match(/^\d+$/)) {
      const value = parseInt(arg);
      if (isNaN(value) || !RouletteBot.ALL_PLACES.includes(value)) {
        return `invalid space '${arg}'`;
      }
      return [value];
    } else if (arg.match(/^\d+-\d+$/)) {
      const args = arg.split('-');
      const start = parseInt(args[0]);
      const end = parseInt(args[1]);
      if (isNaN(start) || isNaN(end) ||
          !RouletteBot.ALL_PLACES.includes(start) ||
          !RouletteBot.ALL_PLACES.includes(end) ||
          start > end) {
        return `invalid space range '${arg}'`;
      }
      return RouletteBot.ALL_PLACES.slice(start, end + 1);
    }
    return `invalid space argument '${arg}'`;
  }

  static parseBetCommand(tokens: string[]): BetCommand | string {
    let betNumbers: number[] = [], amount: number;

    amount = parseInt(tokens[1]);
    if (isNaN(amount) && tokens[1] !== "all") {
      return "amount must be a number or 'all'";
    }

    if (tokens.length < 3) {
      return "too few arguments";
    }
    const parseSpaceRanges = (start: number): number[] | string => {
      const res: number[] = [];
      for (let i = 0; i < tokens.length - start; i++) {
        const values = RouletteBot.parseSpaceRange(tokens[start + i]);
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

  updateUsername(context: ChatContext) {
    this.userData.update(context['user-id'], (inPlaceValue, hadKey) => { inPlaceValue.username = context.username; });
  }

  ensureBalance(userId: string, amount: number): number | string {
    const info = this.userData.get(userId);
    if (amount <= 0) {
      return `You can bet only a positive amount of points, ${info.username}!`;
    }
    amount = isNaN(amount) ? info.balance : amount;
    if (amount > info.balance) {
      return `You don't have that many points, ${info.username}!`;
    }
    return amount;
  }

  betHandler(context: ChatContext, args: string[]): string | undefined {
    this.updateUsername(context);
    // Place a bet
    const userId = context['user-id'];
    const betCommand = RouletteBot.parseBetCommand(args);
    if (typeof betCommand === 'string') {
      return `Parse error: ${betCommand}, try !bet <points> <outcome...>, ${context['username']}!`;
    }
    const amount = this.ensureBalance(userId, betCommand.amount);
    if (typeof amount === 'string') {
      return amount;
    }
    console.log(`* bet ${userId}, ${betCommand.amount}, ${betCommand.betNumbers}`);
    this.roulette.placeBet(userId, amount, betCommand.betNumbers);
    return `${context.username} placed a bet of ${amount} on ${betCommand.betName}!`;
  }

  unbetHandler(context: ChatContext, args: string[]): string | undefined {
    this.updateUsername(context);
    // Remove a bet
    const userId = context['user-id'];

    this.roulette.unplaceBet(userId);
    return `${context.username} is not betting anymore!`;
  }

  private createWinningsCallback(message: (username: string | undefined, didWin: boolean, payout: number, percent: number, balance: number) => string) {
    return (playerId: string, didWin: boolean, chance: number, payout: number) => {
      let username: string | undefined;
      let balance: number = 0;
      payout = Math.floor(payout);
      this.userData.update(playerId, (inPlaceValue, hadKey) => { balance = inPlaceValue.balance += payout; username = inPlaceValue.username; });
      return message(username, didWin, payout, chance, balance);
    }
  }

  rouletteHandler(context: ChatContext, args: string[]): string | undefined {
    this.updateUsername(context);
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
    this.roulette.computeWinnings((playerId: string, didWin: boolean, chance: number, payout: number) => {
      msg += ", " + callback(playerId, didWin, chance, payout);
    });
    return msg;
  }

  pointsHandler(context: ChatContext, args: string[]): string | undefined {
    this.updateUsername(context);
    // Print the user's points
    const userId = context['user-id'];

    let msg = `You have ${this.userData.get(userId).balance} points`;
    const bet = this.roulette.getBet(userId);
    if (bet !== undefined) {
      msg += ` (currently betted ${bet} of those)`
    }
    return msg + `, ${context['username']}!`;
  }

  claimHandler(context: ChatContext, args: string[]): string | undefined {
    this.updateUsername(context);
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
    this.updateUsername(context);
    return `Top 3 richest people in our chat: ` + Object
      .entries(this.userData.getAll())
      .map(([id, data]) => { return { username: data.username, balance: data.balance }; })
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 3)
      .map(a => `${a.username} with ${a.balance} points`)
      .join(", ") + ".";
  }

  static parsePredictCommand(tokens: string[]): PredictCommand | string {
    let amount = parseInt(tokens[1]);
    if (isNaN(amount) && tokens[1] !== "all") {
      return "amount must be a number or 'all'";
    }

    if (tokens.length < 3) {
      return "too few arguments";
    }

    const parsed = RouletteBot.parseSpaceRange(tokens[2]);
    if (typeof parsed === 'string') {
      return parsed;
    }
    if (parsed.length !== 1) {
      return "can only predict a single outcome";
    }
    return { predictNumber: parsed[0], amount };
  }

  predictHandler(context: ChatContext, args: string[]): string | undefined {
    this.updateUsername(context);
    const userId = context['user-id'];
    if (!this.predictionOpen) {
      return `Predictions are closed, ${context['username']}!`;
    }
    const predictCommand = RouletteBot.parsePredictCommand(args);
    if (typeof predictCommand === 'string') {
      return `Parse error: ${predictCommand}, try !predict <points> <outcome>, ${context['username']}!`;
    }
    const amount = this.ensureBalance(userId, predictCommand.amount);
    if (typeof amount === 'string') {
      return amount;
    }
    console.log(`* predict ${userId}, ${predictCommand.amount}, ${predictCommand.predictNumber}`);
    this.prediction.placeBet(userId, amount, [predictCommand.predictNumber]);
    return `${context.username} predicted ${predictCommand.predictNumber} with ${amount} points!`;
  }

  unpredictHandler(context: ChatContext, args: string[]): string | undefined {
    this.updateUsername(context);
    if (!this.predictionOpen) {
      return `Predictions are closed, ${context['username']}!`;
    }
    const userId = context['user-id'];
    this.prediction.unplaceBet(userId);
    return `${context.username} is not predicting anymore!`;
  }

  predictStatusHandler(context: ChatContext, args: string[]): string | undefined {
    this.updateUsername(context);
    const chances = this.prediction.allNumberChances();
    let msg = "Prediction status: ";
    let isFirst = true;
    for (var i of this.prediction.allNumbers) {
      if (chances[i] > 0) {
        if (isFirst) {
          isFirst = false;
        } else {
          msg += ", ";
        }
        msg += `outcome ${i}: ${Math.round(chances[i] * 100)}% of votes (${Math.round(100 * (1 / chances[i] - 1)) / 100}x coef)`;
      }
    }
    if (isFirst) {
      return "Nothing is predicted yet!";
    }
    return msg;
  }

  refundHandler(context: ChatContext, args: string[]): string | undefined {
    this.updateUsername(context);
    if (!context.mod) {
      return `Peasant ${context['username']}, you can't refund a prediction!`;
    }
    this.predictionOpen = false;
    this.prediction.reset();
    return `An honorable mod has refunded the prediction!`;
  }

  openPredictionHandler(context: ChatContext, args: string[]): string | undefined {
    this.updateUsername(context);
    if (!context.mod) {
      return `Peasant ${context['username']}, you can't open a prediction!`;
    }
    this.predictionOpen = true;
    return `An honorable mod has opened a prediction!`;
  }

  closePredictionHandler(context: ChatContext, args: string[]): string | undefined {
    this.updateUsername(context);
    if (!context.mod) {
      return `Peasant ${context['username']}, you can't close a prediction!`;
    }
    this.predictionOpen = false;
    return `An honorable mod has closed a prediction!`;
  }

  outcomeHandler(context: ChatContext, args: string[]): string | undefined {
    this.updateUsername(context);
    if (!context.mod) {
      return `Peasant ${context['username']}, you can't select a prediction outcome!`;
    }

    let msg = "";

    if (this.predictionOpen) {
      msg += "Closing the prediction. ";
      this.predictionOpen = false;
    }

    if (args.length < 2) {
      return msg += `Dear mod ${context['username']}, too few arguments`;
    }
    const number = RouletteBot.parseSpaceRange(args[1]);
    if (typeof number === 'string') {
      return msg += `Dear mod ${context['username']}, I couldn't parse the outcome: ${number}!`;
    }
    if (number.length !== 1) {
      return msg += `Dear mod ${context['username']}, I can only handle a single outcome`;
    }

    this.prediction.lastNumber = number[0];
    msg += `Prediction resulted in outcome '${number}'`;
    const callback = this.createWinningsCallback((username: string | undefined, didWin: boolean, delta: number, chance: number, balance: number) => {
      if (didWin) {
        return `${username} won ${delta} points (coef ${Math.round(100 * (1 / chance - 1)) / 100}x) and now has ${balance} points`;
      } else {
        return `${username} lost ${-delta} points (coef ${Math.round(100 * (1 / chance - 1)) / 100}x) and now has ${balance} points`;
      }
    });
    this.prediction.computeWinnings((playerId: string, didWin: boolean, chance: number, payout: number) => {
      msg += ", " + callback(playerId, didWin, chance, payout);
    });
    return msg;
  }
}