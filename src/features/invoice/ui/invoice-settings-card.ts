import { buildFixedFooter } from '../../../ui/chrome';
import type { InvoiceSettingsView } from './invoice-settings-view';

export function buildInvoiceSettingsCard(
  view: InvoiceSettingsView,
): GoogleAppsScript.Card_Service.Card {
  const translation = CardService.newTextInput()
    .setFieldName(view.translation.fieldName)
    .setTitle(view.translation.title)
    .setValue(view.translation.value);
  const voiceOver = CardService.newTextInput()
    .setFieldName(view.voiceOver.fieldName)
    .setTitle(view.voiceOver.title)
    .setValue(view.voiceOver.value);

  const currency = CardService.newSelectionInput()
    .setFieldName(view.currencyFieldName)
    .setTitle(view.currencyTitle)
    .setType(CardService.SelectionInputType.DROPDOWN);
  for (const item of view.currencyItems) {
    currency.addItem(item.label, item.value, item.selected);
  }

  return CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle(view.title)
        .setSubtitle(view.subtitle),
    )
    .addSection(
      CardService.newCardSection()
        .setHeader(view.ratesHeader)
        .addWidget(translation)
        .addWidget(voiceOver),
    )
    .addSection(CardService.newCardSection().addWidget(currency))
    .setFixedFooter(buildFixedFooter(view.footer))
    .build();
}
