import { BetCommand, RouletteBot } from '../src/roulettebot';
import * as assert from 'assert';

function parse(command: string) {
  return RouletteBot.parseBetCommand((" " + command).split(/\s+/));
}

function test(command: string, expected: BetCommand | undefined) {
  if (expected === undefined) {
    assert.strictEqual(typeof parse(command), 'string');
  } else {
    assert.deepStrictEqual(parse(command), expected);
  }
}

test("100 0", {
  betNumbers: [0],
  betName: "0",
  amount: 100
});
test("100 1", {
  betNumbers: [1],
  betName: "1",
  amount: 100
});
test("100 30", {
  betNumbers: [30],
  betName: "30",
  amount: 100
});
test("100 36", {
  betNumbers: [36],
  betName: "36",
  amount: 100
});

test("100 red", {
  betNumbers: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
  betName: "red",
  amount: 100
});

test("200 black", {
  betNumbers: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35],
  betName: "black",
  amount: 200
});

test("300 green", {
  betNumbers: [0],
  betName: "green",
  amount: 300
});

test("100 split 1 2", {
  betNumbers: [1, 2],
  betName: "split",
  amount: 100
});
test("100 split 2 3", {
  betNumbers: [2, 3],
  betName: "split",
  amount: 100
});
test("100 split 3 4", undefined);
test("100 split 4 5", {
  betNumbers: [4, 5],
  betName: "split",
  amount: 100
});
test("100 split 26 27", {
  betNumbers: [26, 27],
  betName: "split",
  amount: 100
});
test("100 split 35 36", {
  betNumbers: [35, 36],
  betName: "split",
  amount: 100
});
test("100 split 36 37", undefined);
test("100 split 0 1", undefined);
test("100 split 1 1", undefined);
test("100 split 1 4", {
  betNumbers: [1, 4],
  betName: "split",
  amount: 100
});
test("100 split 2 5", {
  betNumbers: [2, 5],
  betName: "split",
  amount: 100
});
test("100 split 5 2", {
  betNumbers: [2, 5],
  betName: "split",
  amount: 100
});
test("100 split 3 6", {
  betNumbers: [3, 6],
  betName: "split",
  amount: 100
});
test("100 split 33 36", {
  betNumbers: [33, 36],
  betName: "split",
  amount: 100
});

test("100 street 1 2 3", {
  betNumbers: [1, 2, 3],
  betName: "street",
  amount: 100
});
test("100 street 4 5 6", {
  betNumbers: [4, 5, 6],
  betName: "street",
  amount: 100
});
test("100 street 31 32 33", {
  betNumbers: [31, 32, 33],
  betName: "street",
  amount: 100
});
test("100 street 1 4 7", undefined);
test("100 street 1 2 4", undefined);
test("100 street 0 1 2", undefined);
test("100 street 0 1 1", undefined);

test("100 corner 1 2 4 5", {
  betNumbers: [1, 2, 4, 5],
  betName: "corner",
  amount: 100
});
test("100 corner 5 4 2 1", {
  betNumbers: [1, 2, 4, 5],
  betName: "corner",
  amount: 100
});
test("100 corner 17 18 20 21", {
  betNumbers: [17, 18, 20, 21],
  betName: "corner",
  amount: 100
});
test("100 corner 32 33 35 36", {
  betNumbers: [32, 33, 35, 36],
  betName: "corner",
  amount: 100
});
test("100 corner 1 2 3 4", undefined);
test("100 corner 0 1 2 3", undefined);
test("100 corner 31 33 35 36", undefined);
test("100 corner 31 35 36 33", undefined);

test("100 doublestreet 1 2 3 4 5 6", {
  betNumbers: [1, 2, 3, 4, 5, 6],
  betName: "doublestreet",
  amount: 100
});
test("100 doublestreet 4 5 6 7 8 9", {
  betNumbers: [4, 5, 6, 7, 8, 9],
  betName: "doublestreet",
  amount: 100
});
test("100 doublestreet 7 8 9 4 5 6", {
  betNumbers: [4, 5, 6, 7, 8, 9],
  betName: "doublestreet",
  amount: 100
});
test("100 doublestreet 31 32 33 34 35 36", {
  betNumbers: [31, 32, 33, 34, 35, 36],
  betName: "doublestreet",
  amount: 100
});
test("100 doublestreet 0 1 2 3 4 5", undefined);
test("100 doublestreet 1 2 3 7 8 9", undefined);
test("100 doublestreet 7 8 9 1 2 3", undefined);
test("100 doublestreet 34 35 36 37 38 39", undefined);

test("100 column1", {
  betNumbers: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
  betName: "column1",
  amount: 100
});

test("100 column2", {
  betNumbers: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  betName: "column2",
  amount: 100
});

test("100 column3", {
  betNumbers: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  betName: "column3",
  amount: 100
});

test("100 dozen1", {
  betNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  betName: "dozen1",
  amount: 100
});

test("100 dozen2", {
  betNumbers: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  betName: "dozen2",
  amount: 100
});

test("100 dozen3", {
  betNumbers: [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
  betName: "dozen3",
  amount: 100
});

test("100 odd", {
  betNumbers: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35],
  betName: "odd",
  amount: 100
});

test("100 even", {
  betNumbers: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36],
  betName: "even",
  amount: 100
});

test("100 1to18", {
  betNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  betName: "1to18",
  amount: 100
});

test("100 19to36", {
  betNumbers: [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
  betName: "19to36",
  amount: 100
});

test("100 all", {
  betNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
  betName: "all",
  amount: 100
});

test("100 all0", {
  betNumbers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
  betName: "all0",
  amount: 100
});
