import { escapeCardHtml } from '../../../shared/ui/card-text';
import {
  buildCardAction,
  buildCardHeader,
  buildEmptyStateSection,
  buildFixedFooter,
  buildSettingsCog,
} from '../../../ui/chrome';
import type {
  OverviewHomeView,
  OverviewLinkView,
  OverviewProjectView,
  OverviewStatusView,
} from './overview-home-view';

const NOT_SET_UP_ICON_URL =
  'https://www.gstatic.com/images/icons/material/system/1x/error_red_24dp.png';
const NOT_SET_UP_COLOR = '#d93025';
const OVERVIEW_CARD_WIDGET_LIMIT = 100;
const OVERVIEW_CARD_SECTION_LIMIT = 100;

export function buildOverviewHomeCard(
  view: OverviewHomeView,
): GoogleAppsScript.Card_Service.Card {
  const widgets =
    1 +
    (view.invoiceWarning ? 1 : 0) +
    (view.empty ? 2 : 0) +
    view.projects.reduce(
      (total, project) => total + (project.status ? 3 : 2),
      0,
    );
  const sections =
    1 +
    (view.invoiceWarning ? 1 : 0) +
    (view.empty ? 1 : 0) +
    view.projects.length;
  if (
    widgets > OVERVIEW_CARD_WIDGET_LIMIT ||
    sections > OVERVIEW_CARD_SECTION_LIMIT
  ) {
    throw new Error(
      'This Overview has too many projects to display. Split it or reduce project items, then reload.',
    );
  }
  const builder = CardService.newCardBuilder()
    .setHeader(buildCardHeader(view.title, view.subtitle))
    .addSection(
      CardService.newCardSection().addWidget(buildSettingsCog(view.settings)),
    );

  if (view.invoiceWarning) {
    builder.addSection(
      CardService.newCardSection()
        .setHeader(view.invoiceWarning.header)
        .addWidget(
          CardService.newTextParagraph().setText(
            escapeCardHtml(view.invoiceWarning.text),
          ),
        ),
    );
  }

  if (view.empty) {
    builder.addSection(buildEmptyStateSection(view.empty));
  }

  for (const project of view.projects) {
    builder.addSection(buildProjectSection(project));
  }

  if (view.footer) {
    builder.setFixedFooter(buildFixedFooter(view.footer));
  }

  return builder.build();
}

function buildProjectSection(
  project: OverviewProjectView,
): GoogleAppsScript.Card_Service.CardSection {
  const links = CardService.newButtonSet();
  for (const link of project.links) {
    links.addButton(buildLinkButton(link));
  }

  const section = CardService.newCardSection()
    .addWidget(
      CardService.newDecoratedText()
        .setTopLabel(project.topLabel)
        .setText(escapeCardHtml(project.characters))
        .setWrapText(true),
    )
    .addWidget(links);

  if (project.status) {
    section.addWidget(buildStatusRow(project.status));
  }
  return section;
}

function buildLinkButton(
  link: OverviewLinkView,
): GoogleAppsScript.Card_Service.TextButton {
  const button = CardService.newTextButton()
    .setText(link.label)
    .setAltText(link.altText);
  if ('openUrl' in link) {
    return button.setOpenLink(CardService.newOpenLink().setUrl(link.openUrl));
  }
  return button.setOnClickAction(buildCardAction(link.action));
}

function buildStatusRow(
  status: OverviewStatusView,
): GoogleAppsScript.Card_Service.DecoratedText {
  const escaped = escapeCardHtml(status.text);
  const text =
    status.icon === 'error'
      ? `<font color="${NOT_SET_UP_COLOR}"><b>${escaped}</b></font>`
      : escaped;
  const row = CardService.newDecoratedText().setText(text).setWrapText(true);

  if (status.icon === 'error') {
    row.setStartIcon(
      CardService.newIconImage()
        .setAltText(status.iconAltText ?? 'Not set up')
        .setIconUrl(NOT_SET_UP_ICON_URL),
    );
  } else if (status.icon === 'clock') {
    row.setStartIcon(
      CardService.newIconImage()
        .setAltText(status.iconAltText ?? status.text)
        .setIcon(CardService.Icon.CLOCK),
    );
  }

  if (status.bottomLabel) {
    row.setBottomLabel(status.bottomLabel);
  }

  if (status.action && status.actionLabel) {
    const button = CardService.newTextButton()
      .setText(status.actionLabel)
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(buildCardAction(status.action));
    if (status.actionAltText) {
      button.setAltText(status.actionAltText);
    }
    row.setButton(button);
  }

  return row;
}
