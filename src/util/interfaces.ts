export { ChatContext, BotHandler, Bot, composeBots }

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
