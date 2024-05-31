export { CardSuit, Card, Deck, GameResult, Status, HitStatus, BlackJack };

enum CardSuit {
  Heart = "Heart",
  Club = "Club",
  Spade = "Spade",
  Diamond = "Diamond",
}

class Card {
  value: number;
  suit: CardSuit;

  constructor(value: number, suit: CardSuit) {
    this.value = value;
    this.suit = suit;
  }

  toString(): string {
    let vstr = "";
    switch (this.value) {
      case 1:
        vstr = "A";
        break;
      case 11:
        vstr = "J";
        break;
      case 12:
        vstr = "Q";
        break;
      case 13:
        vstr = "K";
        break;
      default:
        vstr = this.value.toString();
    }
    let sstr = "";
    switch (this.suit) {
      case CardSuit.Heart:
        sstr = "♥";
        break;
      case CardSuit.Club:
        sstr = "♣";
        break;
      case CardSuit.Spade:
        sstr = "♠";
        break;
      case CardSuit.Diamond:
        sstr = "♦";
        break;
    }
    return `${vstr}${sstr}`;
  }
}

class Deck {
  cards: Card[] = [];

  constructor(cards: Card[] | undefined = undefined) {
    if (cards !== undefined) {
      this.cards = cards;
    } else {
      for (let i = 1; i < 14; i++) {
        for (let j in CardSuit) {
          this.cards.push(new Card(i, CardSuit[j]));
        }
      }
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  pop(): Card {
    return this.cards.pop();
  }
}

interface GameResult {
  ranking: string[][];
}

interface Status {
  balance: number;
  result?: GameResult;
}

interface HitStatus extends Status {
  card: Card;
}

class BlackJack {
  deck: Deck = new Deck();
  hands: { [key: string]: Card[] } = {};
  players: string[] = [];
  currentPlayer: number = -1;

  constructor(players: string[], deck: Deck = new Deck()) {
    this.deck = deck;
    this.players = players;
    for (let player of players) {
      this.hands[player] = [this.deck.pop(), this.deck.pop()];
    }
  }

  init(): GameResult | undefined {
    return this.selectNextPlayer();
  }

  static getBalance(hand: Card[]): number {
    let hasAce = false, balance = 0;
    for (let card of hand) {
      hasAce ||= card.value === 1;
      balance += Math.min(card.value, 10);
    }
    if (hasAce && balance + 10 <= 21) {
      balance += 10;
    }
    return balance;
  }

  static getScore(hand: Card[]): number {
    const balance = BlackJack.getBalance(hand);
    if (this.is21(balance) && hand.length === 2) {
      return 22;
    }
    if (this.isBust(balance)) {
      return 0;
    }
    return balance;
  }

  static isBust(balance: number): boolean {
    return balance > 21;
  }

  static is21(balance: number): boolean {
    return balance === 21;
  }

  isPlaying(player: string): boolean {
    return !BlackJack.is21(BlackJack.getBalance(this.hands[player])) && !BlackJack.isBust(BlackJack.getBalance(this.hands[player]));
  }

  nPlaying(): number {
    return this.players.reduce((a, b) => a + (this.isPlaying(b) ? 1 : 0), 0);
  }

  getCurrentPlayer(): string {
    return this.players[this.currentPlayer];
  }

  calcResult(): GameResult {
    let ranking: { [key: number]: string[] } = {};
    for (let player of this.players) {
      const score = BlackJack.getScore(this.hands[player]);
      ranking[score] ||= [];
      ranking[score].push(player);
    }
    return {
      ranking: Object.entries(ranking)
        .map(([k, v]) => ({ balance: Number(k), players: v }))
        .sort((a, b) => b.balance - a.balance)
        .map(x => x.players.sort())
    };
  }

  selectNextPlayer(): GameResult | undefined {
    do {
      this.currentPlayer++;
    } while (this.currentPlayer < this.players.length && !this.isPlaying(this.players[this.currentPlayer]));

    if (this.currentPlayer === this.players.length || this.nPlaying() === 1) {
      return this.calcResult();
    }
  }

  hit(): HitStatus {
    const player = this.getCurrentPlayer();
    const card = this.deck.pop();
    this.hands[player].push(card);
    const balance = BlackJack.getBalance(this.hands[player]);
    let status: HitStatus = { result: undefined, card, balance };
    if (!this.isPlaying(player)) {
      status.result = this.selectNextPlayer();
    }
    return status;
  }

  stand(): Status {
    const player = this.getCurrentPlayer();
    return { result: this.selectNextPlayer(), balance: BlackJack.getBalance(this.hands[player]) };
  }
}
