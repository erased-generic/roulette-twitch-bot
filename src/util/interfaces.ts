export { ChatContext, Bot, composeBots }

interface ChatContext {
  username?: string;
  "user-id": string;
  mod: boolean;
}

interface Bot {
  readonly handlers: { [key: string]: (context: ChatContext, args: string[]) => string | undefined }

  onHandlerCalled(context: ChatContext, args: string[]): void;
}

function composeBots(bots: Bot[]): Bot {
  return {
    handlers: bots.reduce((acc, bot) => ({ ...acc, ...bot.handlers }), {}),
    onHandlerCalled(context, args) {
      for (const bot of bots) {
        bot.onHandlerCalled(context, args);
      }
    }
  };
}
