import * as blackjackModule from "../util/blackjack";
import { DuelAccepted } from "./duelbot";
import { BlackJackDuelBot } from './blackjackduelbot';

export { TwitchBlackJackDuelBot };

class TwitchBlackJackDuelBot
  extends BlackJackDuelBot
{
  protected override printDuelIntro(
    duel: DuelAccepted<blackjackModule.BlackJack>
  ): string {
    return (
      "If twitch blocks you from sending identical messages, " +
      "you can put random garbage at the end of the message."
    );
  }
}
