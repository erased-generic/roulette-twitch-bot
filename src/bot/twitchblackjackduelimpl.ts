import * as blackjackModule from "../util/blackjack";
import { DuelAccepted, DuelBot } from "./duelbot";
import {
  BlackJackDuelImpl,
  blackJackDuelImplConfig,
} from "./blackjackduelimpl";
import {
  ConfigName,
  Configurable,
} from "../util/interfaces";

export { twitchBlackJackDuelImplConfig, TwitchBlackJackDuelImpl };

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
    duel: DuelAccepted<blackjackModule.BlackJack>
  ): string {
    return (
      "If twitch blocks you from sending identical messages, " +
      "you can put random garbage at the end of the message."
    );
  }
}
