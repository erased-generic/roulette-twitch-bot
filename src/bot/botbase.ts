export { PerUserData, onReadUserData, BotBase, UsernameUpdaterBot, composeBotsWithUsernameUpdater };

import * as userDataModule from '../util/userdata';
import { Bot, ChatContext, composeBots } from '../util/interfaces';
import { RouletteBase } from '../util/roulette';

interface PerUserData {
  username?: string;
  balance: number;
  reservedBalance: number;
  lastClaim?: number;
}

function onReadUserData(read: any): PerUserData {
  let defaultPerUserData: PerUserData = {
    username: undefined,
    balance: 100,
    reservedBalance: 0,
    lastClaim: undefined
  };

  const result = { ...defaultPerUserData, ...read };
  result.reservedBalance = 0;
  return result;
}

abstract class BotBase {
  readonly userData: userDataModule.UserData<PerUserData>;
  constructor(userData: userDataModule.UserData<PerUserData>) {
    this.userData = userData;
  }

  static parseSpaceRange(arg: string, all_places: number[]): number[] | string {
    if (arg.match(/^\d+$/)) {
      const value = parseInt(arg);
      if (isNaN(value) || !all_places.includes(value)) {
        return `invalid space '${arg}'`;
      }
      return [value];
    } else if (arg.match(/^\d+-\d+$/)) {
      const args = arg.split('-');
      const start = parseInt(args[0]);
      const end = parseInt(args[1]);
      if (isNaN(start) || isNaN(end) ||
          !all_places.includes(start) ||
          !all_places.includes(end) ||
          start > end) {
        return `invalid space range '${arg}'`;
      }
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    return `invalid space argument '${arg}'`;
  }

  static parseAmount(arg: string): number | string {
    const amount = parseInt(arg);
    if (isNaN(amount) && arg !== "all") {
      return "amount must be a number or 'all'";
    }
    return amount;
  }

  updateUsername(context: ChatContext) {
    this.userData.get(context['user-id']).username = context.username;
  }

  getUsername(userId: string) {
    return this.userData.get(userId).username;
  }

  protected getBalanceInfo(info: PerUserData): number {
    return info.balance - info.reservedBalance;
  }

  protected getBalance(userId: string): number {
    const info = this.userData.get(userId);
    return this.getBalanceInfo(info);
  }

  protected reserveBalance(userId: string, amount: number) {
    this.userData.update(userId, (inPlaceValue, hadKey) => {
      inPlaceValue.reservedBalance += amount;
    });
  }

  protected ensureBalance(userId: string, amount: number, extraReserveLimit?: number): number | string {
    const info = this.userData.get(userId);
    if (amount <= 0) {
      return `You can bet only a positive amount of points, ${info.username}!`;
    }
    const balance = this.getBalance(userId) + (extraReserveLimit ?? 0);
    amount = isNaN(amount) ? balance : amount;
    if (amount > balance) {
      return `You don't have that many points, ${info.username}!`;
    }
    this.reserveBalance(userId, amount - (extraReserveLimit ?? 0));
    return amount;
  }

  protected createWinningsCallback(message: (username: string | undefined, didWin: boolean, payout: number, percent: number, balance: number) => string) {
    return (playerId: string, didWin: boolean, chance: number, amount: number, payout: number) => {
      let username: string | undefined;
      let balance: number = 0;
      payout = Math.floor(payout);
      this.userData.update(playerId, (inPlaceValue, hadKey) => {
        inPlaceValue.reservedBalance -= amount;
        balance = inPlaceValue.balance += payout;
        username = inPlaceValue.username;
      });
      return message(username, didWin, payout, chance, balance);
    }
  }

  protected bet(rouletteBase: RouletteBase, userId: string, amount: number, numbers: number[]): number | string {
    const ensured = this.ensureBalance(userId, amount, rouletteBase.getBet(userId));
    if (typeof ensured === 'string') {
      return ensured;
    }
    rouletteBase.placeBet(userId, ensured, numbers);
    return ensured;
  }

  protected unbet(rouletteBase: RouletteBase, userId: string) {
    const prevBet = rouletteBase.getBet(userId);
    if (prevBet !== undefined) {
      this.reserveBalance(userId, -prevBet);
    }
    rouletteBase.unplaceBet(userId);
  }

  protected unbetAll(rouletteBase: RouletteBase) {
    for (const userId in rouletteBase.bets) {
      this.unbet(rouletteBase, userId);
    }
    rouletteBase.reset();
  }
}

class UsernameUpdaterBot extends BotBase implements Bot {
  handlers: {};

  constructor(userData: userDataModule.UserData<PerUserData>) {
    super(userData);
  }

  onHandlerCalled(context: ChatContext, args: string[]): void {
    this.updateUsername(context);
  }
}

function composeBotsWithUsernameUpdater(
  botConstructors: ((userData: userDataModule.UserData<PerUserData>) => Bot)[],
  userData: userDataModule.UserData<PerUserData>
): Bot {
  const bots = [new UsernameUpdaterBot(userData), ...botConstructors.map(constructor => constructor(userData))];
  return composeBots(bots);
}
