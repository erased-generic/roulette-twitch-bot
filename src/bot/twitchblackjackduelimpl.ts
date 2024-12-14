import * as blackjackModule from "../util/blackjack";
import { DuelAccepted, DuelBot } from "./duelbot";
import { BlackJackDuelImpl } from './blackjackduelimpl';

export { TwitchBlackJackDuelImpl };

class TwitchBlackJackDuelImpl
  extends BlackJackDuelImpl
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
