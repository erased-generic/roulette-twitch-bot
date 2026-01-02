export { twitchBlackJackDuelImplConfig, TwitchBlackJackDuelImpl };

import * as blackjackModule from "../util/blackjack";
import { DuelAccepted, DuelBot } from "./duelbot";
import {
  BlackJackDuelImpl,
  blackJackDuelImplConfig,
} from "./blackjackduelimpl";
import { ConfigName, Configurable, HandlerContext } from "../util/interfaces";

function twitchBlackJackDuelImplConfig() {
  return blackJackDuelImplConfig();
}

@ConfigName("TwitchBlackJackDuelImpl", twitchBlackJackDuelImplConfig)
class TwitchBlackJackDuelImpl
  extends BlackJackDuelImpl
  implements Configurable
{
  override printDuelIntro(
    bot: DuelBot,
    context: HandlerContext,
    duel: DuelAccepted<blackjackModule.BlackJack>
  ): string {
    return (
      "If twitch blocks you from sending identical messages, " +
      "you can put random garbage at the end of the message."
    );
  }
}
