export {
  instanceTestHandler,
  createTestUserData,
  createTestBot,
  splitCommand,
  instanceTestParser,
  setBalanceNoReserved,
  setBalance
};

import * as assert from 'assert';
import { Bot, ChatContext } from '../src/util/interfaces';
import { PerUserData, composeBotsWithUsernameUpdater, onReadUserData } from '../src/bot/botbase';
import { MemoryUserData, UserData } from '../src/util/userdata';
import { BalanceBot } from '../src/bot/balancebot';

function createTestUserData() {
  return new MemoryUserData<PerUserData>(onReadUserData, {});
}

function createTestBot(bots: ((userData: UserData<PerUserData>) => Bot)[], userData: UserData<PerUserData>) {
  return composeBotsWithUsernameUpdater([
    u => new BalanceBot(u),
    ...bots
  ], userData);
}

function splitCommand(cmd: string) {
  return cmd.split(/\s+/);
}

function instanceTestParser<T>(parse: (args: string[]) => T | string, command: string, expected: T | undefined) {
  if (expected === undefined) {
    assert.strictEqual(typeof parse(splitCommand(command)), 'string');
  } else {
    assert.deepStrictEqual(parse(splitCommand(command)), expected);
  }
}

function instanceTestHandler(botInstance: Bot, chatContext: ChatContext, command: string, expected: RegExp) {
  const args = splitCommand(command);
  let name = args[0].substring(1);
  botInstance.onHandlerCalled(chatContext, args);
  assert.match(botInstance.handlers[name](chatContext, args), expected);
}

function setBalance(userData: UserData<PerUserData>, userId: string, balance: number) {
  userData.get(userId).balance = balance;
}

function setBalanceNoReserved(userData: UserData<PerUserData>, userId: string, balance: number) {
  userData.get(userId).balance = balance;
  assert.strictEqual(userData.get(userId).reservedBalance, 0);
}
