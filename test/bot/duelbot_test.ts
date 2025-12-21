import { DuelBot } from "../../src/bot/duelbot";
import {
  TwitchBlackJackDuelImpl,
  twitchBlackJackDuelImplConfig,
} from "../../src/bot/twitchblackjackduelimpl";

import { ChatContext } from "../../src/util/interfaces";
import { Deck } from "../../src/util/blackjack";
import {
  createTestBot,
  createTestBotConfig,
  instanceTestHandler,
  setBalanceNoReserved,
} from "./utils";

// test an actual duel
const config = createTestBotConfig();
const userData = config.userData;
const myDeck = new Deck();
const instance = createTestBot(
  [
    new DuelBot({
      ...config,
      playerShuffleChance: 0,
      duelImpls: {
        bj: new TwitchBlackJackDuelImpl({
          ...twitchBlackJackDuelImplConfig(),
          deckGenerator: () => myDeck,
        }),
      },
    }),
  ],
  config
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
