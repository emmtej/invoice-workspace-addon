import { escapeCardHtml } from '../../../shared/ui/card-text';
import { buildCardAction } from '../../../ui/chrome';
import type { DocsAccessView } from './docs-access-view';

export function buildDocsFileAccessCard(
  view: DocsAccessView,
): GoogleAppsScript.Card_Service.Card {
  const section = CardService.newCardSection()
    .addWidget(
      CardService.newTextParagraph().setText(escapeCardHtml(view.body)),
    )
    .addWidget(
      CardService.newTextButton()
        .setText(view.grantLabel)
        .setAltText(view.grantAltText)
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(buildCardAction(view.grantAction)),
    )
    .addWidget(
      CardService.newTextParagraph().setText(escapeCardHtml(view.afterClick)),
    );

  return CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle(view.title)
        .setSubtitle(view.subtitle),
    )
    .addSection(section)
    .build();
}
