import { escapeCardHtml } from '../../../shared/ui/card-text';
import { buildCardAction, buildFixedFooter } from '../../../ui/chrome';
import type { LineAuditRowView, LineAuditView } from './line-audit-view';

const REVIEW_COLOR = '#B3261E';

export function buildLineAuditCard(
  view: LineAuditView,
): GoogleAppsScript.Card_Service.Card {
  const filter = CardService.newSelectionInput()
    .setFieldName(view.filter.fieldName)
    .setTitle(view.filter.title)
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setOnChangeAction(buildCardAction(view.filter.action));
  for (const item of view.filter.items) {
    filter.addItem(item.label, item.value, item.selected);
  }

  const builder = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle(view.title)
        .setSubtitle(view.subtitle),
    )
    .addSection(CardService.newCardSection().addWidget(filter))
    .addSection(
      CardService.newCardSection().addWidget(
        CardService.newDecoratedText()
          .setText(escapeCardHtml(view.summaryText))
          .setBottomLabel(view.summaryBottomLabel)
          .setWrapText(true),
      ),
    );

  if (view.strip) {
    builder.addSection(
      CardService.newCardSection().addWidget(
        CardService.newDecoratedText()
          .setText(`<b>${escapeCardHtml(view.strip.text)}</b>`)
          .setWrapText(true)
          .setButton(
            CardService.newTextButton()
              .setText(view.strip.toggle.label)
              .setAltText(view.strip.toggle.altText)
              .setOnClickAction(buildCardAction(view.strip.toggle.action)),
          ),
      ),
    );
  }

  builder.addSection(buildLedgerSection(view));
  return builder.setFixedFooter(buildFixedFooter(view.footer)).build();
}

function buildLedgerSection(
  view: LineAuditView,
): GoogleAppsScript.Card_Service.CardSection {
  const section = CardService.newCardSection();
  if (view.empty) {
    return section.addWidget(
      CardService.newTextParagraph().setText(escapeCardHtml(view.empty)),
    );
  }
  return section.addWidget(
    CardService.newTextParagraph().setText(buildLedgerHtml(view.rows)),
  );
}

function buildLedgerHtml(rows: readonly LineAuditRowView[]): string {
  return rows.map(formatLedgerRow).join('<br><br>');
}

function formatLedgerRow(row: LineAuditRowView): string {
  const parts = [`L${row.lineNumber}`, ` · <b>${row.typeLabel}</b>`];
  if (row.billedWords !== undefined) {
    parts.push(` · <b>${row.billedWords} words</b>`);
  }
  if (row.needsReview) {
    parts.push(
      ` · <font color="${REVIEW_COLOR}"><b>REVIEW</b></font>`,
    );
  }
  return `${parts.join('')}<br>${escapeCardHtml(row.text)}`;
}
