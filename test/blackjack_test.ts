import * as blackjack from '../src/util/blackjack';
import * as assert from 'assert';

// Test general case
{
  let instance = new blackjack.BlackJack(['player1', 'player2', 'player3', 'player4'], new blackjack.Deck([
    new blackjack.Card(5, blackjack.CardSuit.Spade),
    new blackjack.Card(10, blackjack.CardSuit.Spade),
    new blackjack.Card(2, blackjack.CardSuit.Spade),

    new blackjack.Card(4, blackjack.CardSuit.Club),
    new blackjack.Card(4, blackjack.CardSuit.Diamond),

    new blackjack.Card(1, blackjack.CardSuit.Diamond),
    new blackjack.Card(9, blackjack.CardSuit.Club),

    new blackjack.Card(1, blackjack.CardSuit.Heart),
    new blackjack.Card(10, blackjack.CardSuit.Heart),

    new blackjack.Card(9, blackjack.CardSuit.Club),
    new blackjack.Card(9, blackjack.CardSuit.Diamond),
  ]));
  assert.deepStrictEqual(instance.init(), undefined);
  assert.strictEqual(blackjack.BlackJack.getBalance(instance.hands['player1']), 18);
  assert.strictEqual(blackjack.BlackJack.getBalance(instance.hands['player2']), 21);
  assert.strictEqual(blackjack.BlackJack.getBalance(instance.hands['player3']), 20);
  assert.strictEqual(blackjack.BlackJack.getBalance(instance.hands['player4']), 8);
  assert.strictEqual(instance.getCurrentPlayer(), 'player1');
  assert.deepStrictEqual(instance.hit(), { card: new blackjack.Card(2, blackjack.CardSuit.Spade), balance: 20, result: undefined });
  assert.strictEqual(instance.getCurrentPlayer(), 'player1');
  // bust
  assert.deepStrictEqual(instance.hit(), { card: new blackjack.Card(10, blackjack.CardSuit.Spade), balance: 30, result: undefined });
  // skip blackjacked player2
  assert.strictEqual(instance.getCurrentPlayer(), 'player3');
  // overflow Ace from 11 to 1
  assert.deepStrictEqual(instance.hit(), { card: new blackjack.Card(5, blackjack.CardSuit.Spade), balance: 15, result: undefined });
  assert.strictEqual(instance.getCurrentPlayer(), 'player3');
  assert.deepStrictEqual(instance.stand(), { balance: 15, result: undefined });
  assert.strictEqual(instance.getCurrentPlayer(), 'player4');
  assert.deepStrictEqual(instance.stand(), { balance: 8, result: { ranking: [['player2'], ['player3'], ['player4'], ['player1']] } });
}

// Test duels
{
  let instance = new blackjack.BlackJack(['player1', 'player2'], new blackjack.Deck([
    new blackjack.Card(4, blackjack.CardSuit.Spade),

    new blackjack.Card(9, blackjack.CardSuit.Spade),
    new blackjack.Card(9, blackjack.CardSuit.Heart),

    new blackjack.Card(9, blackjack.CardSuit.Club),
    new blackjack.Card(9, blackjack.CardSuit.Diamond),
  ]));
  assert.deepStrictEqual(instance.init(), undefined);
  assert.strictEqual(blackjack.BlackJack.getBalance(instance.hands['player1']), 18);
  assert.strictEqual(blackjack.BlackJack.getBalance(instance.hands['player2']), 18);
  assert.strictEqual(instance.getCurrentPlayer(), 'player1');
  // bust
  assert.deepStrictEqual(instance.hit(), {
    card: new blackjack.Card(4, blackjack.CardSuit.Spade),
    balance: 22,
    result: { ranking: [['player2'], ['player1']] }
  });
}

{
  let instance = new blackjack.BlackJack(['player1', 'player2'], new blackjack.Deck([
    new blackjack.Card(3, blackjack.CardSuit.Spade),

    new blackjack.Card(9, blackjack.CardSuit.Spade),
    new blackjack.Card(9, blackjack.CardSuit.Heart),

    new blackjack.Card(9, blackjack.CardSuit.Club),
    new blackjack.Card(9, blackjack.CardSuit.Diamond),
  ]));
  assert.deepStrictEqual(instance.init(), undefined);
  assert.strictEqual(blackjack.BlackJack.getBalance(instance.hands['player1']), 18);
  assert.strictEqual(blackjack.BlackJack.getBalance(instance.hands['player2']), 18);
  assert.strictEqual(instance.getCurrentPlayer(), 'player1');
  // 21
  assert.deepStrictEqual(instance.hit(), {
    card: new blackjack.Card(3, blackjack.CardSuit.Spade),
    balance: 21,
    result: { ranking: [['player1'], ['player2']] }
  });
}

{
  let instance = new blackjack.BlackJack(['player1', 'player2'], new blackjack.Deck([
    new blackjack.Card(3, blackjack.CardSuit.Spade),

    new blackjack.Card(9, blackjack.CardSuit.Spade),
    new blackjack.Card(9, blackjack.CardSuit.Heart),

    new blackjack.Card(9, blackjack.CardSuit.Club),
    new blackjack.Card(9, blackjack.CardSuit.Diamond),
  ]));
  assert.deepStrictEqual(instance.init(), undefined);
  assert.strictEqual(blackjack.BlackJack.getBalance(instance.hands['player1']), 18);
  assert.strictEqual(blackjack.BlackJack.getBalance(instance.hands['player2']), 18);
  assert.strictEqual(instance.getCurrentPlayer(), 'player1');
  // stand
  assert.deepStrictEqual(instance.stand(), {
    balance: 18,
    result: undefined
  });
  assert.strictEqual(instance.getCurrentPlayer(), 'player2');
  // stand, tie
  assert.deepStrictEqual(instance.stand(), {
    balance: 18,
    result: { ranking: [['player1', 'player2']] }
  });
}

{
  let instance = new blackjack.BlackJack(['player1', 'player2'], new blackjack.Deck([
    new blackjack.Card(3, blackjack.CardSuit.Spade),

    new blackjack.Card(10, blackjack.CardSuit.Spade),
    new blackjack.Card(9, blackjack.CardSuit.Heart),

    new blackjack.Card(9, blackjack.CardSuit.Club),
    new blackjack.Card(9, blackjack.CardSuit.Diamond),
  ]));
  assert.deepStrictEqual(instance.init(), undefined);
  assert.strictEqual(blackjack.BlackJack.getBalance(instance.hands['player1']), 18);
  assert.strictEqual(blackjack.BlackJack.getBalance(instance.hands['player2']), 19);
  assert.strictEqual(instance.getCurrentPlayer(), 'player1');
  // stand
  assert.deepStrictEqual(instance.stand(), {
    balance: 18,
    result: undefined
  });
  assert.strictEqual(instance.getCurrentPlayer(), 'player2');
  // stand, tie
  assert.deepStrictEqual(instance.stand(), {
    balance: 19,
    result: { ranking: [['player2'], ['player1']] }
  });
}

{
  let instance = new blackjack.BlackJack(['player1', 'player2'], new blackjack.Deck([
    new blackjack.Card(3, blackjack.CardSuit.Spade),

    new blackjack.Card(10, blackjack.CardSuit.Spade),
    new blackjack.Card(9, blackjack.CardSuit.Heart),

    new blackjack.Card(1, blackjack.CardSuit.Club),
    new blackjack.Card(10, blackjack.CardSuit.Diamond),
  ]));
  // instant blackjack
  assert.deepStrictEqual(instance.init(), { ranking: [['player1'], ['player2']] });
}

{
  let instance = new blackjack.BlackJack(['player1', 'player2'], new blackjack.Deck([
    new blackjack.Card(1, blackjack.CardSuit.Heart),
    new blackjack.Card(1, blackjack.CardSuit.Spade),

    new blackjack.Card(10, blackjack.CardSuit.Spade),
    new blackjack.Card(9, blackjack.CardSuit.Heart),

    new blackjack.Card(1, blackjack.CardSuit.Club),
    new blackjack.Card(1, blackjack.CardSuit.Diamond),
  ]));
  assert.deepStrictEqual(instance.init(), undefined);
  assert.strictEqual(blackjack.BlackJack.getBalance(instance.hands['player1']), 12);
  assert.strictEqual(blackjack.BlackJack.getBalance(instance.hands['player2']), 19);
  assert.strictEqual(instance.getCurrentPlayer(), 'player1');
  // overflow ace -> 1
  assert.deepStrictEqual(instance.hit(), {
    card: new blackjack.Card(1, blackjack.CardSuit.Spade),
    balance: 13,
    result: undefined
  });
  // overflow another ace -> 1
  assert.deepStrictEqual(instance.hit(), {
    card: new blackjack.Card(1, blackjack.CardSuit.Heart),
    balance: 14,
    result: undefined
  });
}
