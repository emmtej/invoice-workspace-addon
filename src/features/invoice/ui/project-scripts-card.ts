import { escapeCardHtml } from '../../../shared/ui/card-text';
import {
  buildCardAction,
  buildCardHeader,
  buildFixedFooter,
  buildPagingSection,
} from '../../../ui/chrome';
import type {
  ProjectScriptFileView,
  ProjectScriptsView,
} from './project-scripts-view';

export function buildProjectScriptsCard(
  view: ProjectScriptsView,
): GoogleAppsScript.Card_Service.Card {
  const builder = CardService.newCardBuilder()
    .setHeader(buildCardHeader(view.title, view.subtitle))
    .addSection(
      CardService.newCardSection().addWidget(
        CardService.newTextParagraph().setText(escapeCardHtml(view.summary)),
      ),
    );

  for (const file of view.files) {
    builder.addSection(buildFileSection(file));
  }

  if (view.paging) {
    builder.addSection(buildPagingSection(view.paging));
  }
  if (view.footer) {
    builder.setFixedFooter(buildFixedFooter(view.footer));
  }
  return builder.build();
}

function buildFileSection(
  file: ProjectScriptFileView,
): GoogleAppsScript.Card_Service.CardSection {
  const section = CardService.newCardSection();
  const fileRow = CardService.newDecoratedText()
    .setText(
      `<b>${escapeCardHtml(file.name)}</b><br>${escapeCardHtml(file.text)}`,
    )
    .setWrapText(true);
  if (file.review) {
    fileRow.setButton(
      CardService.newTextButton()
        .setText(file.review.label)
        .setAltText(file.review.altText)
        .setOnClickAction(buildCardAction(file.review.action)),
    );
  }
  section.addWidget(fileRow);

  if (file.preview) {
    for (const line of file.preview) {
      section.addWidget(
        CardService.newDecoratedText()
          .setTopLabel(`Line ${line.lineNumber} · ${line.typeLabel}`)
          .setText(
            escapeCardHtml(line.text === '' ? '(blank)' : line.text),
          )
          .setWrapText(true),
      );
    }
  }
  if (file.previewOverflow !== undefined && file.previewOverflow > 0) {
    section.addWidget(
      CardService.newTextParagraph().setText(
        escapeCardHtml(`… plus ${file.previewOverflow} more`),
      ),
    );
  }
  return section;
}
