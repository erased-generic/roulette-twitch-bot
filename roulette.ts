export { Bet, RouletteBase, Roulette, Prediction };

interface Bet {
  amount: number;
  numbers: number[];
}

abstract class RouletteBase {
  // Object to store players and their bets
  bets: { [key: string]: Bet };
  // Last winning number
  lastNumber: number;
  // Maximum payout for a single bet
  payoutCap: number;
  // All betting places
  allNumbers: number[];

  static getAllNumbers(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  constructor(n: number, payoutCap: number) {
    this.bets = {};
    this.lastNumber = NaN;
    this.payoutCap = payoutCap;
    this.allNumbers = RouletteBase.getAllNumbers(n);
  }

  // Method to accept bets from players
  placeBet(playerId: string, betAmount: number, betNumbers: number[]): void | string {
    this.bets[playerId] = { amount: betAmount, numbers: betNumbers };
  }

  // Method to remove a bet from a player
  unplaceBet(playerId: string) {
    delete this.bets[playerId];
  }

  // Method to get a player's bet
  getBet(playerId: string): number | undefined {
    const bet = this.bets[playerId];
    if (bet !== undefined) {
      return bet.amount;
    }
    return undefined;
  }

  // Method to run the roulette and get the winning number
  runRoulette() {
    const winningNumber = this.allNumbers[Math.floor(Math.random() * this.allNumbers.length)];
    return this.lastNumber = winningNumber;
  }

  // Compute the chance of winning
  abstract numberChance(playerBet: Bet): number;

  // Method to compute winnings for each player based on the last winning number
  computeWinnings(callback: (playerId: string, didWin: boolean, chance: number, payout: number, amount: number) => void) {
    for (const playerId in this.bets) {
      const playerBet = this.bets[playerId];
      let chance = this.numberChance(playerBet);
      let payout = 0;
      const didWin = playerBet.numbers.includes(this.lastNumber);
      if (didWin) {
        const invChance = 1 / chance;
        payout = Math.floor(invChance - 1);
        if (!isNaN(this.payoutCap)) {
          payout = Math.min(payout, this.payoutCap);
        }
      }
      callback(playerId, didWin, chance, payout, playerBet.amount);
    }
    // Reset players' bets for the next round
    this.reset();
  }

  // Method to reset players' bets
  reset() {
    this.bets = {};
  }
}

// Roulette class
class Roulette extends RouletteBase {
  constructor(n: number) {
    super(n, n - 2);
  }

  // Method to calculate independent winning chance
  numberChance(playerBet: Bet): number {
    const winningChance = playerBet.numbers.length / this.allNumbers.length;
    if (playerBet.numbers.includes(this.lastNumber)) {
      return winningChance;
    }
    return 1 - winningChance;
  }
}

// Predictions class
class Prediction extends RouletteBase {
  constructor(n: number) {
    super(n, NaN);
  }

  // Method to accept bets from players
  placeBet(playerId: string, betAmount: number, betNumbers: number[]) {
    if (betNumbers.length !== 1) {
      return 'You can only predict one outcome';
    }
    return super.placeBet(playerId, betAmount, betNumbers);
  }

  predictionChance(num: number): number {
    let curBets = 0, allBets = 0;
    for (const playerId in this.bets) {
      allBets += this.bets[playerId].amount;
      if (this.bets[playerId].numbers.includes(num)) {
        curBets += this.bets[playerId].amount / this.bets[playerId].numbers.length;
      }
    }

    return curBets / allBets;
  }

  // Method to calculate prediction winning chance
  numberChance(playerBet: Bet): number {
    return this.predictionChance(playerBet.numbers[0]);
  }
}
