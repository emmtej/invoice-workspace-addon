import { buildFixedFooter } from '../../../ui/chrome';
import type { AdditionalCharactersView } from './additional-characters-view';

export function buildAdditionalCharactersCard(
  view: AdditionalCharactersView,
): GoogleAppsScript.Card_Service.Card {
  const input = CardService.newTextInput()
    .setFieldName(view.fieldName)
    .setTitle(view.fieldTitle)
    .setHint(view.hint)
    .setMultiline(true)
    .setValue(view.value);

  return CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle(view.title)
        .setSubtitle(view.subtitle),
    )
    .addSection(CardService.newCardSection().addWidget(input))
    .setFixedFooter(buildFixedFooter(view.footer))
    .build();
}
