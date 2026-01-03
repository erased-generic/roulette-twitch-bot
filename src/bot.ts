import * as interfaces from "./util/interfaces";
import * as botBase from "./bot/botbase";
import * as fs from "fs";
import tmi from "tmi.js";

import "./bot/twitch_all_bots";

interface AuthParams {
  username: string;
  channels: string[];
  client_id: string;
  client_secret: string;
  access_token: string;
  refresh_token: string;
  scope: string[];
}

const authPath = "data/private/auth.json";
const auth: AuthParams = JSON.parse(fs.readFileSync(authPath, "utf8"));

const botManager = new botBase.BotManager(
  botBase.createConfigurableBotFactory(
    auth.username,
    "data/public/config.yaml"
  ),
  botBase.createFileUserData
);

function createTmiClient() {
  const opts = {
    identity: {
      username: auth.username,
      password: `oauth:${auth.access_token}`,
    },
    channels: auth.channels,
  };

  // Create a client with our options
  const client = new tmi.Client(opts);

  // Register our event handlers (defined below)
  client.on("chat", onChatHandler);
  client.on("connected", onConnectedHandler);
  client.on("disconnected", onDisconnectedHandler);
  return client;
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

// Connect to Twitch:
let client = createTmiClient();

async function refreshTokens() {
  console.log("Requesting token refresh...");
  const body = new URLSearchParams({
    client_id: auth.client_id,
    client_secret: auth.client_secret,
    grant_type: "refresh_token",
    refresh_token: auth.refresh_token,
  });
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: body.toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
  });

  if (!response.ok || response.body === null) {
    console.error(
      `Token refresh failed: ${response.status}, ${response.statusText}`
    );
    return;
  }

  const responseBody: RefreshResponse =
    await (response.json() as Promise<RefreshResponse>);
  console.log("Refreshing tokens...");
  auth.access_token = responseBody.access_token;
  auth.refresh_token = responseBody.refresh_token;
  fs.writeFileSync(authPath, JSON.stringify(auth), "utf8");
  console.log("Reconnecting...");
  client = createTmiClient();
  return client.connect();
}

client.connect().catch(async (reason) => {
  if (reason == "Login authentication failed") {
    await refreshTokens();
  } else {
    console.error(`error: ${reason}`);
  }
});

const MAX_MSG_LENGTH = 500;
const ANY_MSG_COOLDOWN_MS = 3_000;
const DUP_MSG_COOLDOWN_MS = 30_000;
function say(target: string, msg: string) {
  msg = msg.replace("\n", " ");
  if (msg.length > MAX_MSG_LENGTH) {
    const message = msg;
    let lastSpace = message.slice(0, MAX_MSG_LENGTH).lastIndexOf(" ");
    if (lastSpace === -1) {
      lastSpace = MAX_MSG_LENGTH;
    }
    msg = message.slice(0, lastSpace);

    let futureMsg = message.slice(lastSpace + 1);
    console.log(`* delay say: ${futureMsg}[${futureMsg.length}]`);
    setTimeout(() => say(target, futureMsg), ANY_MSG_COOLDOWN_MS);
  }
  console.log(`* say: ${msg}[${msg.length}]`);
  if (msg.length === 0) {
    return;
  }
  client.say(target, msg).catch((reason: Error) => {
    console.log(
      `Error sending message "${msg}": ${reason.message}, retrying...`
    );
    if (reason.message.includes("'msg_duplicate'")) {
      setTimeout(() => {
        console.log(`* re-say: ${msg}`);
        client.say(target, msg).catch((reason: Error) => {
          console.log(`Error re-sending message "${msg}": ${reason.message}`);
        });
      }, DUP_MSG_COOLDOWN_MS);
    } else if (reason.message.includes("'msg_ratelimit'")) {
      setTimeout(() => {
        console.log(`* re-say: ${msg}`);
        client.say(target, msg).catch((reason: Error) => {
          console.log(`Error re-sending message "${msg}": ${reason.message}`);
        });
      }, ANY_MSG_COOLDOWN_MS);
    }
  });
}

// Called every time a message comes in
function onChatHandler(
  target: string,
  context: tmi.ChatUserstate,
  msg: string,
  self: boolean
) {
  if (self) {
    return;
  } // Ignore messages from the bot

  const theBot = botManager.getOrCreateBot(target);

  msg = msg.trim();
  const selected = interfaces.selectHandler(theBot, msg);
  if (selected === undefined) {
    console.log(`${context.username}: [private]`);
    return;
  }

  if (selected.handler === undefined) {
    console.log(`${context.username}: [private]`);
    console.log(`* ${context.username} Unknown command ${msg}`);
    return;
  }

  console.log(
    `${context.username}: ${msg} [${theBot.getContext().cmdMarker}${
      selected.key
    } ${selected.args.filter((x, i) => i > 0).join(" ")}]`
  );

  const userId = context["user-id"];
  if (userId === undefined) {
    say(target, `Sorry, I don't know who you are, ${context["username"]}!`);
    return;
  }
  let chatContext = {
    ...context,
    "user-id": userId,
    "sent-at": parseInt(context["tmi-sent-ts"]!, 10),
    mod: context.mod === true || context.badges?.broadcaster !== undefined,
  };
  let response = interfaces.callHandler(
    theBot,
    selected.handler,
    chatContext,
    selected.args
  );
  if (response !== undefined) {
    say(target, response);
  }
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler(address: string, port: number) {
  console.log(`* Connected to ${address}:${port}`);
}

// Called on disconnect
async function onDisconnectedHandler(reason: string) {
  console.log("* Disconnected");
  if (reason == "Login authentication failed") {
    await refreshTokens();
  } else {
    console.error(`error: ${reason}`);
  }
}

const doDisconnect = () => {
  console.log("* Disconnecting...");
  client.disconnect().then(() => process.exit(0));
};

process.on("SIGINT", doDisconnect);
process.on("SIGTERM", doDisconnect);
