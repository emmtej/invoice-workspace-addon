import { escapeCardHtml } from '../../../shared/ui/card-text';
import {
  buildCardAction,
  buildCardHeader,
  buildEmptyStateSection,
  buildFixedFooter,
  buildPagingSection,
  buildSettingsCog,
} from '../../../ui/chrome';
import type {
  InvoiceHomeView,
  InvoiceParseButtonView,
  InvoiceProjectRowView,
} from './invoice-home-view';

export function buildInvoiceHomeCard(
  view: InvoiceHomeView,
): GoogleAppsScript.Card_Service.Card {
  const builder = CardService.newCardBuilder()
    .setHeader(buildCardHeader(view.title, view.subtitle))
    .addSection(
      CardService.newCardSection().addWidget(buildSettingsCog(view.settings)),
    );

  if (view.empty) {
    builder.addSection(buildEmptyStateSection(view.empty));
  }

  for (const project of view.projects) {
    builder.addSection(buildProjectSection(project));
  }

  if (view.paging) {
    builder.addSection(buildPagingSection(view.paging));
  }

  return builder.setFixedFooter(buildFixedFooter(view.footer)).build();
}

function buildProjectSection(
  project: InvoiceProjectRowView,
): GoogleAppsScript.Card_Service.CardSection {
  const section = CardService.newCardSection()
    .addWidget(
      CardService.newDecoratedText()
        .setTopLabel(project.topLabel)
        .setText(escapeCardHtml(project.title))
        .setWrapText(true),
    )
    .addWidget(
      CardService.newTextParagraph().setText(
        project.wordLines.map((line) => escapeCardHtml(line)).join('<br>'),
      ),
    );

  if (project.folderProblem) {
    const folderLines = [escapeCardHtml(project.folderProblem)];
    if (project.recovery) {
      folderLines.push(escapeCardHtml(project.recovery));
    }
    section.addWidget(
      CardService.newTextParagraph().setText(folderLines.join('<br>')),
    );
  }
  if (project.parseOriginal && project.parseTranslated) {
    section.addWidget(
      CardService.newButtonSet()
        .addButton(buildParseButton(project.parseOriginal))
        .addButton(buildParseButton(project.parseTranslated)),
    );
  }
  return section;
}

function buildParseButton(
  view: InvoiceParseButtonView,
): GoogleAppsScript.Card_Service.TextButton {
  return CardService.newTextButton()
    .setText(view.label)
    .setAltText(view.altText)
    .setOnClickAction(buildCardAction(view.action));
}
