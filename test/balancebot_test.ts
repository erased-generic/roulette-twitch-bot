import { ChatContext } from '../src/util/interfaces';
import { createTestBot, createTestUserData, instanceTestHandler, setBalanceNoReserved } from './utils';
import * as assert from 'assert';

// Test the bot itself
const userData = createTestUserData();
const instance = createTestBot([], userData);
const testChatContext = { username: "test", 'user-id': "test", mod: false };

function testHandler(context: ChatContext, command: string, expected: RegExp) {
  return instanceTestHandler(instance, context, command, expected);
}

// test initial balance
testHandler(
  testChatContext,
  "!balance",
  /You have 100 points/
);

// test claims
testHandler(
  testChatContext,
  "!claim",
  /claimed 100 points/
);
// assume that 30 minutes do not pass between these statements
testHandler(
  testChatContext,
  "!claim",
  /on cooldown/
);

// test leaderboard
setBalanceNoReserved(userData, "test", 100);
setBalanceNoReserved(userData, "test1", 200);
setBalanceNoReserved(userData, "test2", 300);
// remember new usernames
testHandler(
  { username: "test1", 'user-id': "test1", mod: false },
  "!balance",
  /You have 200 points/
);
testHandler(
  { username: "test2", 'user-id': "test2", mod: false },
  "!balance",
  /You have 300 points/
);
testHandler(
  testChatContext,
  "!balance",
  /You have 100 points/
);
testHandler(
  testChatContext,
  "!leaderboard",
  /Top 3 richest people in our chat: test2 with 300 points, test1 with 200 points, test with 100 points/
);
testHandler(
  testChatContext,
  "!leaderboard 2",
  /Top 2 richest people in our chat: test2 with 300 points, test1 with 200 points/
);
testHandler(
  testChatContext,
  "!leaderboard 1",
  /Top 1 richest people in our chat: test2 with 300 points/
);
testHandler(
  testChatContext,
  "!leaderboard asda",
  /error/
);
