import { buildWelcomeCard } from '../ui/welcome-card';
import { toWelcomeView } from '../ui/welcome-view';

export function onHomepage(
  _event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.Card {
  return buildWelcomeCard(toWelcomeView('drive'));
}
