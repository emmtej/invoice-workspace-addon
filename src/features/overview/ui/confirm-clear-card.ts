import { escapeCardHtml } from '../../../shared/ui/card-text';
import { buildFixedFooter } from '../../../ui/chrome';
import type { ConfirmClearView } from './confirm-clear-view';

export function buildConfirmClearCard(
  view: ConfirmClearView,
): GoogleAppsScript.Card_Service.Card {
  const section = CardService.newCardSection();
  for (const paragraph of view.paragraphs) {
    section.addWidget(
      CardService.newTextParagraph().setText(escapeCardHtml(paragraph)),
    );
  }

  return CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle(view.title)
        .setSubtitle(view.subtitle),
    )
    .addSection(section)
    .setFixedFooter(buildFixedFooter(view.footer))
    .build();
}
