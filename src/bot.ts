import * as interfaces from './util/interfaces';
import * as balanceBot from './bot/balancebot';
import * as rouletteBot from './bot/roulettebot';
import * as predictionBot from './bot/predictionbot';
import * as duelBot from './bot/duelbot';
import * as botBase from './bot/botbase';
import * as userDataModule from './util/userdata';

const userData = new userDataModule.FileUserData<botBase.PerUserData>(botBase.onReadUserData, "data/table.json");
const theBot: interfaces.Bot = botBase.composeBotsWithUsernameUpdater([
  u => new balanceBot.BalanceBot(u),
  u => new rouletteBot.RouletteBot(u),
  u => new predictionBot.PredictionBot(u, 100),
  u => new duelBot.DuelBot(u),
], userData);

import * as fs from 'fs';
import * as tmi from 'tmi.js';

// Define configuration options
interface AuthParams {
  username: string;
  channels: string[];
  client_id: string;
  client_secret: string;
  access_token: string;
  refresh_token: string;
  scope: string[];
}
const authPath = "data/auth.json";
const auth: AuthParams = JSON.parse(fs.readFileSync(authPath, 'utf8'));

function createTmiClient() {
  const opts = {
    identity: {
      username: auth.username,
      password: `oauth:${auth.access_token}`
    },
    channels: auth.channels
  };

  // Create a client with our options
  const client = new tmi.Client(opts);

  // Register our event handlers (defined below)
  client.on('chat', onChatHandler);
  client.on('connected', onConnectedHandler);

  return client;
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

// Connect to Twitch:
let client = createTmiClient();
client.connect()
  .catch(async (reason) => {
    if (reason == "Login authentication failed") {
      console.log("Requesting token refresh...");
      const body = new URLSearchParams({
        "client_id": auth.client_id,
        "client_secret": auth.client_secret,
        "grant_type": "refresh_token",
        "refresh_token": auth.refresh_token,
      });
      const response = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        body: body.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }
      });

      if (!response.ok || response.body === null) {
        console.error(`Token refresh failed: ${response.status}, ${response.statusText}`);
        return;
      }

      const responseBody: RefreshResponse = await (response.json() as Promise<RefreshResponse>);
      console.log("Refreshing tokens...")
      auth.access_token = responseBody.access_token;
      auth.refresh_token = responseBody.refresh_token;
      fs.writeFileSync(authPath, JSON.stringify(auth), 'utf8');
      console.log("Reconnecting...");
      client = createTmiClient();
      return client.connect();
    } else {
      console.error(`error: ${reason}`);
    }
  });

// Called every time a message comes in
function onChatHandler(target: string, context: tmi.ChatUserstate, msg: string, self: boolean) {
  if (self) { return; } // Ignore messages from the bot

  console.log(`${context.username}: ${msg}`);

  msg = msg.trim();
  const selected = interfaces.selectHandler(theBot, msg);
  if (selected === undefined) {
    return;
  }

  if (selected.handler === undefined) {
    console.log(`* ${context.username} Unknown command ${msg}`);
    return;
  }

  const userId = context['user-id'];
  if (userId === undefined) {
    client.say(target, `Sorry, I don't know who you are, ${context['username']}!`);
    return;
  }
  let chatContext = {
    ...context,
    "user-id": userId,
    mod: (context.mod === true) ||
          (context.badges?.broadcaster !== undefined)
  };
  const response = interfaces.callHandler(theBot, selected.handler, chatContext, selected.args);
  if (response !== undefined) {
    client.say(target, response);
  }
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler(address: string, port: number) {
  console.log(`* Connected to ${address}:${port}`);
}
