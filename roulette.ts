export { Roulette };

class Roulette {
  // Object to store players and their bets
  bets: { [key: string]: { amount: number, numbers: number[] } };
  // Last winning number
  lastNumber: number;

  constructor() {
    this.bets = {};
    this.lastNumber = NaN;
  }

  // Method to accept bets from players
  placeBet(playerId: string, betAmount: number, betNumbers: number[]) {
    this.bets[playerId] = { amount: betAmount, numbers: betNumbers };
  }

  unplaceBet(playerId: string) {
    delete this.bets[playerId];
  }

  getBet(playerId: string): number | undefined {
    const bet = this.bets[playerId];
    if (bet !== undefined) {
      return bet.amount;
    }
    return undefined;
  }

  // Method to get all possible squares
  static getAllNumbers(): number[] {
    const numbers: number[] = [];
    for (let i = 0; i <= 36; i++) {
        numbers.push(i);
    }
    return numbers;
  }

  static allNumbers: number[] = Roulette.getAllNumbers();

  // Method to run the roulette and get the winning number
  runRoulette() {
    const winningNumber = Roulette.allNumbers[Math.floor(Math.random() * Roulette.allNumbers.length)];
    return this.lastNumber = winningNumber;
  }

  // Method to compute winnings for each player based on the last winning number
  computeWinnings(callback: (playerId: string, didWin: boolean, chance: number, payout: number, amount: number) => void) {
    const winningNumber = this.lastNumber;
    for (const playerId in this.bets) {
      const playerBet = this.bets[playerId];
      const chance = playerBet.numbers.length / Roulette.allNumbers.length
      const invChance = Roulette.allNumbers.length / playerBet.numbers.length
      const payout = Math.min(Math.floor(invChance - 1), 35)
      callback(playerId, playerBet.numbers.includes(winningNumber), chance, payout, playerBet.amount);
    }
    // Reset players' bets for the next round
    this.reset();
  }

  // Method to reset players' bets
  reset() {
    this.bets = {};
  }
}
