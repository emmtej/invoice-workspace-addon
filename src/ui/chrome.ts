import { escapeCardHtml } from '../shared/ui/card-text';
import type {
  CardActionSpec,
  ErrorCardView,
  FooterButtonView,
  FooterView,
  PagingView,
  SettingsCogView,
} from './models';

export function buildCardHeader(
  title: string,
  subtitle?: string,
): GoogleAppsScript.Card_Service.CardHeader {
  const header = CardService.newCardHeader().setTitle(title);
  if (subtitle) {
    header.setSubtitle(subtitle);
  }
  return header;
}

export function buildEmptyStateSection(view: {
  title: string;
  hint: string;
}): GoogleAppsScript.Card_Service.CardSection {
  return CardService.newCardSection()
    .addWidget(
      CardService.newTextParagraph().setText(escapeCardHtml(view.title)),
    )
    .addWidget(
      CardService.newTextParagraph().setText(escapeCardHtml(view.hint)),
    );
}

export function buildErrorCard(
  view: ErrorCardView,
): GoogleAppsScript.Card_Service.Card {
  const builder = CardService.newCardBuilder()
    .setHeader(buildCardHeader(view.title, view.subtitle))
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextParagraph().setText(escapeCardHtml(view.message)),
        )
        .addWidget(
          CardService.newTextParagraph().setText(escapeCardHtml(view.recovery)),
        ),
    );
  if (view.footer) {
    builder.setFixedFooter(buildFixedFooter(view.footer));
  }
  return builder.build();
}

export function buildCardAction(
  spec: CardActionSpec,
): GoogleAppsScript.Card_Service.Action {
  const action = CardService.newAction()
    .setFunctionName(spec.functionName)
    .setParameters(spec.parameters);
  if (spec.spinner) {
    action.setLoadIndicator(CardService.LoadIndicator.SPINNER);
  }
  return action;
}

export function buildSettingsCog(
  view: SettingsCogView,
): GoogleAppsScript.Card_Service.DecoratedText {
  return CardService.newDecoratedText()
    .setText(view.label)
    .setWrapText(true)
    .setButton(
      CardService.newImageButton()
        .setAltText(view.altText)
        .setIconUrl(view.iconUrl)
        .setOnClickAction(buildCardAction(view.action)),
    );
}

export function buildFixedFooter(
  view: FooterView,
): GoogleAppsScript.Card_Service.FixedFooter {
  const footer = CardService.newFixedFooter().setPrimaryButton(
    buildFooterButton(view.primary, 'primary'),
  );
  if (view.secondary) {
    footer.setSecondaryButton(buildFooterButton(view.secondary, 'secondary'));
  }
  return footer;
}

export function buildPagingSection(
  view: PagingView,
): GoogleAppsScript.Card_Service.CardSection {
  const buttons = CardService.newButtonSet();
  if (view.previous) {
    buttons.addButton(
      CardService.newTextButton()
        .setText('Previous')
        .setOnClickAction(buildCardAction(view.previous)),
    );
  }
  if (view.next) {
    buttons.addButton(
      CardService.newTextButton()
        .setText('Next')
        .setOnClickAction(buildCardAction(view.next)),
    );
  }
  return CardService.newCardSection().setHeader(view.label).addWidget(buttons);
}

function buildFooterButton(
  view: FooterButtonView,
  role: 'primary' | 'secondary',
): GoogleAppsScript.Card_Service.TextButton {
  const button = CardService.newTextButton()
    .setText(view.label)
    .setTextButtonStyle(
      role === 'secondary'
        ? CardService.TextButtonStyle.OUTLINED
        : CardService.TextButtonStyle.FILLED,
    );
  if (view.altText) {
    button.setAltText(view.altText);
  }
  if (role === 'primary' && 'style' in view && view.style === 'danger') {
    button.setBackgroundColor('#d93025');
  }
  if ('openLink' in view) {
    const openLink = view.openLink;
    const link = CardService.newOpenLink().setUrl(openLink.url);
    if (openLink.openAs === 'full-size') {
      link.setOpenAs(CardService.OpenAs.FULL_SIZE);
    }
    return button.setOpenLink(link);
  }
  return button.setOnClickAction(buildCardAction(view.action));
}
