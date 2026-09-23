import type { CardActionSpec, FooterView } from '../../../ui/models';
import {
  CHANGE_INVOICE_SCRIPT_LINE_AUDIT_PAGE_ACTION,
  SCRIPT_FILE_ID_PARAMETER,
  SCRIPT_LINE_AUDIT_FILTER_PARAMETER,
} from '../invoice-action-ids';
import type {
  InvoiceScriptLineAuditResult,
  InvoiceScriptLineAuditRow,
} from '../invoice-script-results';
import {
  invoiceProjectIdentityParameters,
  openInvoiceFooterButton,
} from './invoice-chrome';
import { lineTypeLabel } from './line-type-label';

const STRIP_LINE_LIMIT = 10;

export type LineAuditFilter =
  | 'all'
  | 'needs-review'
  | 'non-billable'
  | 'billable';

export interface LineAuditFilterView {
  title: string;
  fieldName: string;
  items: readonly {
    label: string;
    value: LineAuditFilter;
    selected: boolean;
  }[];
  action: CardActionSpec;
}

export interface LineAuditStripView {
  text: string;
  toggle: { label: string; altText: string; action: CardActionSpec };
}

export interface LineAuditView {
  title: string;
  subtitle: string;
  filter: LineAuditFilterView;
  summaryText: string;
  summaryBottomLabel: string;
  rows: readonly LineAuditRowView[];
  strip?: LineAuditStripView;
  empty?: string;
  footer: FooterView;
}

export interface LineAuditRowView {
  lineNumber: number;
  typeLabel: string;
  text: string;
  billedWords?: number;
  needsReview: boolean;
}

export function toLineAuditView(
  result: InvoiceScriptLineAuditResult,
  filter: LineAuditFilter = 'all',
): LineAuditView {
  const totalLines = result.rows.length;
  const visible = filterRows(result.rows, filter);
  const reviewCount = result.rows.filter((row) => row.needsReview).length;
  const view: LineAuditView = {
    title: result.file.name,
    subtitle: `${result.project.number} ${result.project.title}`,
    filter: toFilter(result, filter),
    summaryText: summaryText(result.totalBillableWords, totalLines, reviewCount),
    summaryBottomLabel: summaryBottomLabel(visible.length, totalLines, filter),
    rows: visible.map(toRow),
    footer: {
      primary: openInvoiceFooterButton(result.request.invoiceDocumentId),
    },
  };
  const strip = toStrip(result, filter, visible);
  if (strip) {
    view.strip = strip;
  }
  if (visible.length === 0) {
    view.empty = emptyCopy(filter);
  }
  return view;
}

function filterRows(
  rows: readonly InvoiceScriptLineAuditRow[],
  filter: LineAuditFilter,
): readonly InvoiceScriptLineAuditRow[] {
  const hasBillableWords = (row: InvoiceScriptLineAuditRow) =>
    (row.billedWords ?? 0) > 0;
  if (filter === 'needs-review') {
    return rows.filter((row) => row.needsReview);
  }
  if (filter === 'billable') {
    return rows.filter(hasBillableWords);
  }
  if (filter === 'non-billable') {
    return rows.filter((row) => !hasBillableWords(row));
  }
  return rows;
}

function toFilter(
  result: InvoiceScriptLineAuditResult,
  filter: LineAuditFilter,
): LineAuditFilterView {
  return {
    title: 'Show',
    fieldName: SCRIPT_LINE_AUDIT_FILTER_PARAMETER,
    items: [
      { label: 'All lines', value: 'all', selected: filter === 'all' },
      {
        label: 'Needs review',
        value: 'needs-review',
        selected: filter === 'needs-review',
      },
      {
        label: 'Non-billable lines',
        value: 'non-billable',
        selected: filter === 'non-billable',
      },
      {
        label: 'Billable lines',
        value: 'billable',
        selected: filter === 'billable',
      },
    ],
    action: {
      functionName: CHANGE_INVOICE_SCRIPT_LINE_AUDIT_PAGE_ACTION,
      parameters: identityParameters(result),
      spinner: true,
    },
  };
}

function summaryText(
  totalBillableWords: number,
  totalLines: number,
  reviewCount: number,
): string {
  const lineLabel = totalLines === 1 ? '1 line' : `${totalLines} lines`;
  let text = `${totalBillableWords} billable words · ${lineLabel}`;
  if (reviewCount === 1) {
    text += ' · 1 needs review';
  } else if (reviewCount > 1) {
    text += ` · ${reviewCount} need review`;
  }
  return text;
}

function summaryBottomLabel(
  visibleCount: number,
  totalLines: number,
  filter: LineAuditFilter,
): string {
  if (filter === 'all') {
    return 'Showing all lines';
  }
  return `Showing ${visibleCount} of ${totalLines} lines`;
}

function emptyCopy(filter: LineAuditFilter): string {
  if (filter === 'billable') {
    return 'No billable lines.';
  }
  if (filter === 'non-billable') {
    return 'No non-billable lines.';
  }
  if (filter === 'needs-review') {
    return 'No lines need review.';
  }
  return 'No parsed lines.';
}

function toRow(row: InvoiceScriptLineAuditRow): LineAuditRowView {
  return {
    lineNumber: row.lineNumber,
    typeLabel: lineTypeLabel(row.lineType),
    text: row.line === '' ? '(blank)' : row.line,
    ...(row.billedWords === undefined ? {} : { billedWords: row.billedWords }),
    needsReview: row.needsReview,
  };
}

function toStrip(
  result: InvoiceScriptLineAuditResult,
  filter: LineAuditFilter,
  visible: readonly InvoiceScriptLineAuditRow[],
): LineAuditStripView | undefined {
  const flagged = visible.filter((row) => row.needsReview);
  if (flagged.length === 0) {
    return undefined;
  }
  const numbers = flagged.map((row) => row.lineNumber);
  const listed = numbers.slice(0, STRIP_LINE_LIMIT);
  const overflow = numbers.length - listed.length;
  let text: string;
  if (listed.length === 1) {
    text = `Needs review: line ${listed[0]}`;
  } else {
    text = `Needs review: lines ${listed.join(', ')}`;
    if (overflow > 0) {
      text += `, … plus ${overflow} more`;
    }
  }
  const targetFilter = filter === 'needs-review' ? 'all' : 'needs-review';
  const toggleLabel =
    filter === 'needs-review' ? 'Show all lines' : 'Show only these';
  const toggleAlt =
    filter === 'needs-review'
      ? 'Show all parsed lines'
      : 'Show only lines that need review';
  return {
    text,
    toggle: {
      label: toggleLabel,
      altText: toggleAlt,
      action: filterAction(result, targetFilter),
    },
  };
}

function filterAction(
  result: InvoiceScriptLineAuditResult,
  filter: LineAuditFilter,
): CardActionSpec {
  return {
    functionName: CHANGE_INVOICE_SCRIPT_LINE_AUDIT_PAGE_ACTION,
    parameters: {
      ...identityParameters(result),
      [SCRIPT_LINE_AUDIT_FILTER_PARAMETER]: filter,
    },
    spinner: true,
  };
}

function identityParameters(
  result: InvoiceScriptLineAuditResult,
): Record<string, string> {
  return {
    ...invoiceProjectIdentityParameters(result.request),
    [SCRIPT_FILE_ID_PARAMETER]: result.file.id,
  };
}
