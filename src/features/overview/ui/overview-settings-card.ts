import { escapeCardHtml } from '../../../shared/ui/card-text';
import { buildCardAction } from '../../../ui/chrome';
import type { OverviewSettingsView } from './overview-settings-view';

const DANGER_BUTTON_COLOR = '#d93025';

export function buildOverviewSettingsCard(
  view: OverviewSettingsView,
): GoogleAppsScript.Card_Service.Card {
  const extra = CardService.newCardSection()
    .setHeader(view.extraHeader)
    .addWidget(
      CardService.newTextParagraph().setText(escapeCardHtml(view.scopeHint)),
    )
    .addWidget(
      CardService.newDecoratedText()
        .setText(escapeCardHtml(view.toggleLabel))
        .setWrapText(true)
        .setSwitchControl(
          CardService.newSwitch()
            .setFieldName(view.toggleFieldName)
            .setValue(view.toggleValue)
            .setSelected(view.toggleSelected)
            .setOnChangeAction(buildCardAction(view.toggleAction)),
        ),
    )
    .addWidget(
      CardService.newDecoratedText()
        .setText(escapeCardHtml(view.namesLabel))
        .setWrapText(true)
        .setButton(
          CardService.newTextButton()
            .setText(view.editLabel)
            .setAltText(view.editAltText)
            .setOnClickAction(buildCardAction(view.editAction)),
        ),
    )
    .addWidget(
      CardService.newTextParagraph().setText(escapeCardHtml(view.namesLine)),
    );

  const metadata = CardService.newCardSection()
    .setHeader(view.metadataHeader)
    .addWidget(
      CardService.newTextParagraph().setText(escapeCardHtml(view.metadataBody)),
    )
    .addWidget(
      CardService.newButtonSet().addButton(
        CardService.newTextButton()
          .setText(view.clearLabel)
          .setAltText(view.clearAltText)
          .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
          .setBackgroundColor(DANGER_BUTTON_COLOR)
          .setOnClickAction(buildCardAction(view.clearAction)),
      ),
    );

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(view.title))
    .addSection(extra)
    .addSection(metadata)
    .build();
}
