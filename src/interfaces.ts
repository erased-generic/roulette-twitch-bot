export { ChatContext, Bot }

interface ChatContext {
  username?: string;
  "user-id": string;
  mod: boolean;
}

interface Bot {
  readonly handlers: { [key: string]: (context: ChatContext, args: string[]) => string | undefined }
}
