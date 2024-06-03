export { ChatContext, BotHandler, Bot, splitCommand, selectHandler, callHandler, composeBots }

interface ChatContext {
  username?: string;
  "user-id": string;
  mod: boolean;
}

interface BotHandler {
  action: (context: ChatContext, args: string[]) => string | undefined;
  description: string;
  format: string;
}

interface Bot {
  readonly handlers: { [key: string]: BotHandler };

  onHandlerCalled(context: ChatContext, args: string[]): void;
}

function splitCommand(command: string) {
  return command.split(/\s+/);
}

function selectHandler(bot: Bot, command: string): { handler?: BotHandler, key: string, args: string[] } | undefined {
  if (!command.startsWith("!")) {
    return undefined;
  }
  const args = splitCommand(command);
  const key = args[0].substring(1);
  return { handler: bot.handlers[key], key, args };
}

function callHandler(bot: Bot, handler: BotHandler, context: ChatContext, args: string[]): string | undefined {
  bot.onHandlerCalled(context, args);
  return handler.action(context, args)
    .replace("%{format}", `${args[0]} ${handler.format}`);
}

function composeBots(bots: Bot[]): Bot {
  let bot: Bot = {
    handlers: {
      ...bots.reduce((acc, bot) => ({ ...acc, ...bot.handlers }), {}),
      "help": {
        action: (context, args) => {
          if (args.length > 1) {
            const key = args[1];
            if (key in bot.handlers) {
              return `!${key}: ${bot.handlers[key].description}. Format: !${key} ${bot.handlers[key].format}`;
            } else {
              return `!${key} is not a valid command.`
            }
          }
          return `Available commands: ${Object.keys(bot.handlers).map(x => `!${x}`).join(", ")}`;
        },
        description: "List available commands or describe a command",
        format: "[<command name>]"
      }
    },
    onHandlerCalled(context, args) {
      for (const bot of bots) {
        bot.onHandlerCalled(context, args);
      }
    }
  };

  return bot;
}
