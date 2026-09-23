import { escapeCardHtml } from '../shared/ui/card-text';
import type { WelcomeView } from './welcome-view';

export function buildWelcomeCard(
  view: WelcomeView,
): GoogleAppsScript.Card_Service.Card {
  const section = CardService.newCardSection().addWidget(
    CardService.newTextParagraph().setText(view.instruction),
  );

  for (const row of view.rows) {
    section.addWidget(
      CardService.newDecoratedText()
        .setTopLabel(row.name)
        .setText(escapeCardHtml(row.purpose))
        .setWrapText(true),
    );
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(view.title))
    .addSection(section)
    .build();
}
