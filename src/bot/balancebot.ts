export { BalanceBot };

import * as userDataModule from '../util/userdata';
import { Bot, ChatContext } from '../util/interfaces';
import { BotBase, PerUserData } from './botbase';

class BalanceBot extends BotBase implements Bot {
  readonly handlers: { [key: string]: (context: ChatContext, args: string[]) => string | undefined } = {
    "claim": this.claimHandler.bind(this),
    "balance": this.pointsHandler.bind(this),
    "leaderboard": this.leaderboardHandler.bind(this),
  };

  constructor(userData: userDataModule.UserData<PerUserData>) {
    super(userData);
  }

  onHandlerCalled(context: ChatContext, args: string[]): void {}

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
    this.userData.update(userId, (inPlaceValue, hadKey) => {
      inPlaceValue.lastClaim = now;
      balance = inPlaceValue.balance += claimSize;
    });
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
