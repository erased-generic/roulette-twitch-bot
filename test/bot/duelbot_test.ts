import { TwitchBlackJackDuelBot } from "../../src/bot/twitchblackjackduelbot";
import {
  ChatContext,
} from "../../src/util/interfaces";
import {
  Deck,
} from "../../src/util/blackjack";
import {
  createTestBot,
  createTestBotContext,
  instanceTestHandler,
  setBalanceNoReserved,
} from "./utils";

// test an actual duel
const botContext = createTestBotContext();
const userData = botContext.userData;
const myDeck = new Deck();
const instance = createTestBot(
  [
    ctx => new TwitchBlackJackDuelBot(ctx, 0, () => myDeck),
  ],
  botContext
);

const aChatContext = { username: "a", "user-id": "a", mod: false };
const bChatContext = { username: "b", "user-id": "b", mod: false };

function testHandler(context: ChatContext, command: string, expected: RegExp) {
  return instanceTestHandler(instance, context, command, expected);
}

// test twitch message
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
  /If twitch blocks you from sending identical messages/
);
