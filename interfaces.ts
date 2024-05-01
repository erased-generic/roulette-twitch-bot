export { ChatContext, Bot }

interface ChatContext {
  username?: string;
  "user-id": string;
}

interface Bot {
  readonly handlers: { [key: string]: (context: ChatContext, args: string[]) => string | undefined }
}
