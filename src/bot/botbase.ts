export { PerUserData, onReadUserData, BotBase, UsernameUpdaterBot, composeBotsWithUsernameUpdater };

import { UserData, UserDatum } from '../util/userdata';
import { Bot, ChatContext, composeBots } from '../util/interfaces';
import { RouletteBase } from '../util/roulette';

interface PerUserData extends UserDatum {
  balance: number;
  reservedBalance: number;
  lastClaim?: number;
}

function onReadUserData(userId: string, read: any): PerUserData {
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
  readonly userData: UserData<PerUserData>;
  constructor(userData: UserData<PerUserData>) {
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
      console.log(`* reserveBalance: ${userId}, ${inPlaceValue.username}, ${JSON.stringify(inPlaceValue)}, ${amount}`);
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

  protected commitBalance(userId: string, reservedAmount: number, balanceAmount: number): number {
    const botData = this.userData.get(this.userData.botUsername);
    return this.userData.update(userId, (inPlaceValue, hadKey) => {
      console.log(`* balance: ${userId}, ${this.getUsername(userId)}, ${JSON.stringify(inPlaceValue)}, ${reservedAmount}, ${balanceAmount}`);
      inPlaceValue.reservedBalance -= reservedAmount;
      inPlaceValue.balance += balanceAmount;
      // NOTE: direct update of UserData here
      botData.balance -= balanceAmount;
    }).balance;
  }

  protected createWinningsCallback(message: (username: string | undefined, didWin: boolean, payout: number, percent: number, balance: number) => string) {
    return (playerId: string, didWin: boolean, chance: number, amount: number, payout: number) => {
      payout = Math.floor(payout);
      const balance = this.commitBalance(playerId, amount, payout);
      return message(this.getUsername(playerId), didWin, payout, chance, balance);
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

  static appendMsg(msg1: string, msg2: string, sep: string = " ") {
    if (msg1.length > 0 && !msg1.endsWith(sep) && msg2.length > 0) {
      return msg1 + sep + msg2;
    }
    return msg1 + msg2;
  }
}

class UsernameUpdaterBot extends BotBase implements Bot {
  handlers: {};

  constructor(userData: UserData<PerUserData>) {
    super(userData);
  }

  onHandlerCalled(context: ChatContext, args: string[]): void {
    this.updateUsername(context);
  }
}

function composeBotsWithUsernameUpdater(
  botConstructors: ((userData: UserData<PerUserData>) => Bot)[],
  userData: UserData<PerUserData>
): Bot {
  const bots = [new UsernameUpdaterBot(userData), ...botConstructors.map(constructor => constructor(userData))];
  return composeBots(bots);
}
