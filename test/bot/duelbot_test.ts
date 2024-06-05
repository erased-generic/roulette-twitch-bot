import { DuelCommand, DuelBot } from '../../src/bot/duelbot';
import { ChatContext } from '../../src/util/interfaces';
import { Card, CardSuit, Deck } from '../../src/util/blackjack';
import { createTestBot, createTestUserData, instanceTestHandler, instanceTestParser, setBalanceNoReserved } from './utils';

function parse(args: string[]) {
  return DuelBot.parseDuelCommand(["", ...args]);
}

function testParser(command: string, expected: DuelCommand | undefined) {
  return instanceTestParser(parse, command, expected);
}

const userData = createTestUserData();
const myDeck = new Deck();
let instance = createTestBot([
  u => new DuelBot(u, () => myDeck, 0) // use this deck interface and don't shuffle players
], userData);

testParser("100 aaa", {
  amount: 100,
  username: "aaa"
});
testParser("100 1212", {
  amount: 100,
  username: "1212"
});
testParser("100 aaa bbb", undefined);

// Test the bot itself
const aChatContext = { username: "a", 'user-id': "a", mod: false };
const bChatContext = { username: "b", 'user-id': "b", mod: false };
const cChatContext = { username: "c", 'user-id': "c", mod: false };
const dChatContext = { username: "d", 'user-id': "d", mod: false };

function testHandler(context: ChatContext, command: string, expected: RegExp) {
  return instanceTestHandler(instance, context, command, expected);
}

// ensure initial balance
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 100 points/
);
testHandler(
  cChatContext,
  "!balance",
  /You have 100 points/
);
testHandler(
  dChatContext,
  "!balance",
  /You have 100 points/
);

// test duels interface
testHandler(
  aChatContext,
  "!accept",
  /no one requested a duel with you/
);
testHandler(
  aChatContext,
  "!accept b",
  /b didn't request a duel with you/
);
testHandler(
  aChatContext,
  "!duel 10 b",
  /b, reply with !accept \[a\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(
  bChatContext,
  "!duel 10 a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(
  aChatContext,
  "!unduel",
  /a retracted all their duel requests/
);
testHandler(
  bChatContext,
  "!unduel",
  /b retracted all their duel requests/
);
testHandler(
  aChatContext,
  "!duel 1000 b",
  /You don't have that many points/
);
testHandler(
  aChatContext,
  "!duel -1000 b",
  /You can bet only a positive amount of points/
);
testHandler(
  aChatContext,
  "!duel lol b",
  /error/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 100 points, b!/
);
testHandler(
  bChatContext,
  "!duel all a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 100 points!/
);

// test that duel requests overwrite each other
testHandler(
  aChatContext,
  "!duel 10 b",
  /b, reply with !accept \[a\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), a!/
);
testHandler(
  aChatContext,
  "!duel 30 b",
  /b, reply with !accept \[a\] to accept the blackjack duel, if you're ready to bet 30 points!/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 30 of those\), a!/
);

// test that we can duel all-in even if we have 0 points
testHandler(
  aChatContext,
  "!unduel",
  /a retracted all their duel requests/
);
setBalanceNoReserved(userData, "a", 0);
testHandler(
  aChatContext,
  "!duel all b",
  /b, reply with !accept \[a\] to accept the blackjack duel, if you're ready to bet 0 points!/
);

// test that you go all-in if you don't have enough points for accepting the duel
testHandler(
  aChatContext,
  "!unduel",
  /a retracted all their duel requests/
);
setBalanceNoReserved(userData, "a", 10);
testHandler(
  bChatContext,
  "!duel 30 a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 30 points!/
);
testHandler(
  aChatContext,
  "!accept",
  /a is going all-in with 10 points!/
);
testHandler(
  aChatContext,
  "!unduel",
  /you forfeit the duel/
);

// test an actual duel
myDeck.cards = new Deck().cards;
setBalanceNoReserved(userData, "a", 100);
setBalanceNoReserved(userData, "b", 100);
testHandler(
  bChatContext,
  "!duel 10 a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(
  cChatContext,
  "!accept b",
  /b didn't request a duel with you/
);
testHandler(
  aChatContext,
  "!accept",
  /Let the blackjack duel begin! b's hand: K♦,K♠, totaling 20. a's hand: K♣,K♥, totaling 20. b, your move! Type !hit or !stand!/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), a!/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), b!/
);
testHandler(
  cChatContext,
  "!accept b",
  /b is busy/
);
testHandler(
  bChatContext,
  "!duel 10 c",
  /Duel already in progress/
);
testHandler(
  aChatContext,
  "!duel 10 c",
  /Duel already in progress/
);
testHandler(
  cChatContext,
  "!stand",
  /not in a duel/
);
testHandler(
  aChatContext,
  "!stand",
  /it's not your turn/
);
testHandler(
  bChatContext,
  "!stand",
  /a, your move/
);
testHandler(
  bChatContext,
  "!hit",
  /it's not your turn/
);
testHandler(
  aChatContext,
  "!stand",
  /a tie/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points, a!/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 100 points, b!/
);

// test winning
myDeck.cards = new Deck().cards;
setBalanceNoReserved(userData, "a", 100);
setBalanceNoReserved(userData, "b", 100);
testHandler(
  bChatContext,
  "!duel 10 a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(
  aChatContext,
  "!accept",
  /Let the blackjack duel begin! b's hand: K♦,K♠, totaling 20. a's hand: K♣,K♥, totaling 20. b, your move! Type !hit or !stand!/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), a!/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), b!/
);
testHandler(
  bChatContext,
  "!stand",
  /a, your move/
);
testHandler(
  aChatContext,
  "!hit",
  /Q♦, totaling 30 - you busted! The winner is b, b won 10 points and now has 110 points, a lost 10 points and now has 90 points/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 90 points, a!/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 110 points, b!/
);

// test instant winning
myDeck.cards = [
  new Card(9, CardSuit.Club),
  new Card(9, CardSuit.Diamond),

  new Card(1, CardSuit.Heart),
  new Card(10, CardSuit.Heart),
]
setBalanceNoReserved(userData, "a", 100);
setBalanceNoReserved(userData, "b", 100);
testHandler(
  bChatContext,
  "!duel 10 a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(
  aChatContext,
  "!accept",
  new RegExp(
    "Let the blackjack duel begin! " +
    "b's hand: 10♥,A♥, totaling 21\\. a's hand: 9♦,9♣, totaling 18\\. " +
    "The winner is b, b won 10 points and now has 110 points, a lost 10 points and now has 90 points"
  )
);
testHandler(
  aChatContext,
  "!balance",
  /You have 90 points, a!/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 110 points, b!/
);

// test winning with all-in 0 points
myDeck.cards = new Deck().cards;
setBalanceNoReserved(userData, "a", 0);
setBalanceNoReserved(userData, "b", 100);
testHandler(
  bChatContext,
  "!duel 10 a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(
  aChatContext,
  "!accept",
  /Let the blackjack duel begin! b's hand: K♦,K♠, totaling 20. a's hand: K♣,K♥, totaling 20. b, your move! Type !hit or !stand!/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 0 points, a!/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), b!/
);
testHandler(
  bChatContext,
  "!hit",
  /Q♦, totaling 30 - you busted! The winner is a, b lost 10 points and now has 90 points, a won 10 points and now has 10 points/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 10 points, a!/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 90 points, b!/
);

// test two duels at once
myDeck.cards = [
  new Card(8, CardSuit.Heart),
  new Card(8, CardSuit.Spade),

  new Card(8, CardSuit.Club),
  new Card(8, CardSuit.Diamond),

  new Card(9, CardSuit.Heart),
  new Card(9, CardSuit.Spade),

  new Card(9, CardSuit.Club),
  new Card(9, CardSuit.Diamond),

  new Card(10, CardSuit.Heart),
  new Card(10, CardSuit.Spade),

  new Card(10, CardSuit.Club),
  new Card(10, CardSuit.Diamond),
]
const myDeck2 = new Deck();
myDeck2.cards = [
  new Card(8, CardSuit.Heart),
  new Card(8, CardSuit.Spade),

  new Card(8, CardSuit.Club),
  new Card(8, CardSuit.Diamond),

  new Card(9, CardSuit.Heart),
  new Card(9, CardSuit.Spade),
]
let isFirst = true;
instance = createTestBot([
  u => new DuelBot(userData, () => {
    if (isFirst) {
      isFirst = false;
      return myDeck;
    } else {
      return myDeck2;
    }
  }, 1) // use different decks for the two duels, also swap players
], userData);
userData.get("a").balance = 100;
userData.get("b").balance = 100;
userData.get("c").balance = 100;
userData.get("d").balance = 100;
testHandler(
  bChatContext,
  "!duel 10 a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(
  cChatContext,
  "!duel 20 d",
  /d, reply with !accept \[c\] to accept the blackjack duel, if you're ready to bet 20 points!/
);
testHandler(
  dChatContext,
  "!accept b",
  /d, b didn't request a duel with you!/
);
testHandler(
  dChatContext,
  "!accept a",
  /d, a didn't request a duel with you!/
);
testHandler(
  aChatContext,
  "!accept d",
  /a, d didn't request a duel with you!/
);
testHandler(
  aChatContext,
  "!accept c",
  /a, c didn't request a duel with you!/
);
testHandler(
  aChatContext,
  "!accept",
  new RegExp(
    "Let the blackjack duel begin! " +
    "a's hand: 10♦,10♣, totaling 20\\. " +
    "b's hand: 10♠,10♥, totaling 20\\. " +
    "a, your move! Type !hit or !stand!"
  )
);
testHandler(
  dChatContext,
  "!accept",
  new RegExp(
    "Let the blackjack duel begin! " +
    "d's hand: 9♠,9♥, totaling 18\\. " +
    "c's hand: 8♦,8♣, totaling 16\\. " +
    "d, your move! Type !hit or !stand!"
  )
);
testHandler(
  aChatContext,
  "!stand",
  /b, your move/
);
testHandler(
  dChatContext,
  "!stand",
  /c, your move/
);
testHandler(
  bChatContext,
  "!hit",
  new RegExp(
    "b, you pulled a 9♦, totaling 29 - you busted! " +
    "The winner is a, b lost 10 points and now has 90 points, " +
    "a won 10 points and now has 110 points"
  )
);
testHandler(
  cChatContext,
  "!stand",
  /The winner is d, c lost 20 points and now has 80 points, d won 20 points and now has 120 points/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 110 points, a!/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 90 points, b!/
);
testHandler(
  cChatContext,
  "!balance",
  /You have 80 points, c!/
);
testHandler(
  dChatContext,
  "!balance",
  /You have 120 points, d!/
);
