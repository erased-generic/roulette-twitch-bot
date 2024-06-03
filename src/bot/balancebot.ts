export { BalanceBot };

import { UserData } from '../util/userdata';
import { Bot, BotHandler, ChatContext } from '../util/interfaces';
import { BotBase, PerUserData } from './botbase';

class BalanceBot extends BotBase implements Bot {
  readonly handlers: { [key: string]: BotHandler } = {
    "claim": {
      action: this.claimHandler.bind(this),
      description: "Claim 100 points with a 30-minute cooldown",
      format: ""
    },
    "claime": {
      action: this.claimeHandler.bind(this),
      description: "Claim 100 points with a 30-minute cooldown. If you're (un)lucky, doubles or halves your balance",
      format: "[<chance of trickery in %>]=1"
    },
    "balance": {
      action: this.pointsHandler.bind(this),
      description: "View your balance",
      format: ""
    },
    "leaderboard": {
      action: this.leaderboardHandler.bind(this),
      description: "View the leaderboard, sorted by the amount of points",
      format: "[<number of entries to show>]"
    },
  };

  constructor(userData: UserData<PerUserData>) {
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

  doClaim(context: ChatContext, chance: number): string | undefined {
    // Claim 100 points per 30 minutes
    // If `Math.rand() < chance`, double or half your balance
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
    let msg = ``;
    let balance = this.getBalance(userId);
    let delta = claimSize;
    if (Math.random() < chance) {
      if (Math.random() < 0.5) {
        delta = Math.floor(balance / 2) - balance;
        msg += `You halved your balance!`
      } else {
        delta = balance;
        msg += `You doubled your balance!`
      }
    }
    this.userData.update(userId, (inPlaceValue, hadKey) => {
      inPlaceValue.lastClaim = now;
      balance = inPlaceValue.balance += delta;
    });
    if (delta < claimSize) {
      msg = "Unlucky! "+ msg;
    } else if (delta > claimSize) {
      msg = "Lucky! " + msg;
    }
    console.log(`* claim: ${userId}, ${context.username}, ${delta}`);
    return msg + ` You claimed ${delta} points and now have ${balance} points, ${context['username']}!`;
  }

  claimHandler(context: ChatContext, args: string[]): string | undefined {
    return this.doClaim(context, 0);
  }

  claimeHandler(context: ChatContext, args: string[]): string | undefined {
    if (args.length < 2) {
      return this.doClaim(context, 0.01);
    }
    const chance = parseFloat(args[1]);
    if (!isFinite(chance)) {
      return `Parse error: ${args[1]}, try %{format}, ${context['username']}!`;
    }
    return this.doClaim(context, chance);
  }

  leaderboardHandler(context: ChatContext, args: string[]): string | undefined {
    let boardSize = 3;
    if (args.length > 1) {
      boardSize = parseInt(args[1]);
      if (isNaN(boardSize)) {
        return `Parse error: ${args[1]}, try %{format}, ${context['username']}!`;
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
