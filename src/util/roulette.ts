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
  // All betting places
  allNumbers: number[];
  // Casino's edge
  edge: number;

  static getAllNumbers(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  constructor(n: number, edge: number) {
    this.bets = {};
    this.lastNumber = NaN;
    this.edge = edge;
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
  abstract allNumberChances(): number[];

  // Method to compute winnings for each player based on the last winning number
  computeWinnings(callback: (playerId: string, didWin: boolean, chance: number, amount: number, payout: number) => void) {
    // For each number in allNumbers, compute the chance of winning
    const allChances = this.allNumberChances();
    for (const playerId in this.bets) {
      const playerBet = this.bets[playerId];
      let chance = 0;
      for (const i of playerBet.numbers) {
        chance += allChances[i];
      }
      let payout = -playerBet.amount;
      const didWin = playerBet.numbers.includes(this.lastNumber);
      if (didWin) {
        payout += playerBet.amount / playerBet.numbers.length * ((1 - this.edge) / allChances[this.lastNumber]);
      }
      callback(playerId, didWin, chance, playerBet.amount, payout);
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
    super(n, 1 / n);
  }

  // Method to calculate independent winning chance
  allNumberChances(): number[] {
    return this.allNumbers.map(() => 1 / this.allNumbers.length);
  }
}

// Predictions class
class Prediction extends RouletteBase {
  constructor(n: number) {
    super(n, 0);
  }

  // Method to calculate prediction winning chance
  allNumberChances(): number[] {
    let sum = 0;
    let bets = this.allNumbers.map(() => 0);
    for (const playerId in this.bets) {
      sum += this.bets[playerId].amount;
      for (const i of this.bets[playerId].numbers) {
        bets[i] += this.bets[playerId].amount / this.bets[playerId].numbers.length;
      }
    }

    if (sum === 0) {
      for (const playerId in this.bets) {
        for (const i of this.bets[playerId].numbers) {
          sum++;
          bets[i]++;
        }
      }
    }

    return bets.map(b => b / sum);
  }
}
