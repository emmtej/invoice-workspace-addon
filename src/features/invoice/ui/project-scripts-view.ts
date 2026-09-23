import type {
  CardActionSpec,
  FooterView,
  PagingView,
} from '../../../ui/models';
import { toPagingView } from '../../../ui/paging';
import {
  APPLY_INVOICE_PROJECT_SCRIPT_RESULTS_ACTION,
  CHANGE_INVOICE_PROJECT_SCRIPTS_PAGE_ACTION,
  OPEN_INVOICE_SCRIPT_LINE_AUDIT_ACTION,
  PARSING_SIGNATURE_PARAMETER,
  SCRIPT_FILE_ID_PARAMETER,
  SCRIPT_RESULTS_PAGE_PARAMETER,
} from '../invoice-action-ids';
import {
  INVOICE_SCRIPT_RESULTS_PAGE_SIZE,
  getCardPage,
} from '../invoice-card-page';
import type { InvoiceScriptCollection } from '../invoice-projects';
import type {
  InvoiceInvalidLine,
  InvoiceParsedScriptResult,
  InvoiceProjectScriptParsingResult,
  InvoiceScriptResult,
  InvoiceUnavailableScriptResult,
} from '../invoice-script-results';
import { invoiceProjectIdentityParameters } from './invoice-chrome';
import { lineTypeLabel } from './line-type-label';

const PREVIEW_LINE_LIMIT = 3;

const UNAVAILABLE_REASONS: Record<string, string> = {
  'unsupported-mime-type': 'Unsupported file type.',
  'download-disabled': 'Download is disabled.',
  'file-too-large': 'File is too large.',
  'invalid-file-metadata': 'File metadata is invalid.',
  'access-denied': 'File access was denied.',
  'download-failed': 'File download failed.',
  'invalid-docx': 'DOCX package is invalid.',
  'unsupported-docx-structure': 'DOCX structure is unsupported.',
  'unsupported-document-structure': 'Document structure is unsupported.',
  'read-failed': 'File could not be read.',
  'time-limit': 'Parsing time limit reached.',
};

export interface ProjectScriptsView {
  title: string;
  subtitle: string;
  summary: string;
  files: readonly ProjectScriptFileView[];
  paging?: PagingView;
  footer?: FooterView;
}

export interface ProjectScriptPreviewLineView {
  lineNumber: number;
  typeLabel: string;
  text: string;
}

export interface ProjectScriptFileView {
  name: string;
  text: string;
  review?: { label: string; altText: string; action: CardActionSpec };
  preview?: readonly ProjectScriptPreviewLineView[];
  previewOverflow?: number;
}

export function toProjectScriptsView(
  result: InvoiceProjectScriptParsingResult,
  page = 0,
): ProjectScriptsView {
  const scriptPage = getCardPage(
    result.scripts,
    page,
    INVOICE_SCRIPT_RESULTS_PAGE_SIZE,
    'Parsing-results page is no longer available.',
  );
  const complete =
    result.scripts.length > 0 &&
    result.canApply &&
    result.totalBillableWords !== undefined;
  const view: ProjectScriptsView = {
    title: collectionTitle(result.request.collection),
    subtitle: `${result.project.number} ${result.project.title}`,
    summary: summaryText(result, complete),
    files: scriptPage.items.map((script) => toFile(script, result.request)),
  };
  const paging = toPagingView(page, scriptPage.pageCount, (targetPage) => ({
    functionName: CHANGE_INVOICE_PROJECT_SCRIPTS_PAGE_ACTION,
    parameters: {
      ...invoiceProjectIdentityParameters(result.request),
      [PARSING_SIGNATURE_PARAMETER]: result.parsingSignature,
      [SCRIPT_RESULTS_PAGE_PARAMETER]: String(targetPage),
    },
    spinner: true,
  }));
  if (paging) {
    view.paging = paging;
  }
  if (complete && result.totalBillableWords !== undefined) {
    view.footer = applyFooter(result, result.totalBillableWords);
  }
  return view;
}

function collectionTitle(collection: InvoiceScriptCollection): string {
  return collection === 'original' ? 'Original Scripts' : 'Translated Scripts';
}

function flaggedDocumentCount(result: InvoiceProjectScriptParsingResult): number {
  return result.scripts.reduce(
    (total, script) =>
      script.status === 'ready' && script.invalidLines.length > 0
        ? total + 1
        : total,
    0,
  );
}

function summaryText(
  result: InvoiceProjectScriptParsingResult,
  complete: boolean,
): string {
  if (result.scripts.length === 0) {
    return 'No character scripts in this folder.';
  }
  if (complete) {
    const total = `${result.totalBillableWords} words`;
    const documents = flaggedDocumentCount(result);
    if (documents === 1) {
      return `${total} · 1 document needs review`;
    }
    if (documents > 1) {
      return `${total} · ${documents} documents need review`;
    }
    return total;
  }
  return 'Parsing incomplete. Resolve unavailable scripts and parse again.';
}

function toFile(
  script: InvoiceScriptResult,
  request: InvoiceProjectScriptParsingResult['request'],
): ProjectScriptFileView {
  if (script.status === 'unavailable') {
    return {
      name: script.file.name,
      text: unavailableReason(script),
    };
  }
  const file: ProjectScriptFileView = {
    name: script.file.name,
    text: readyText(script),
    review: {
      label: 'Review lines',
      altText: `Review parsed lines for ${script.file.name}`,
      action: {
        functionName: OPEN_INVOICE_SCRIPT_LINE_AUDIT_ACTION,
        parameters: {
          ...invoiceProjectIdentityParameters(request),
          [SCRIPT_FILE_ID_PARAMETER]: script.file.id,
        },
        spinner: true,
      },
    },
  };
  const preview = toPreview(script.invalidLines);
  if (preview.lines.length > 0) {
    file.preview = preview.lines;
  }
  if (preview.overflow > 0) {
    file.previewOverflow = preview.overflow;
  }
  return file;
}

function toPreview(invalidLines: readonly InvoiceInvalidLine[]): {
  lines: ProjectScriptPreviewLineView[];
  overflow: number;
} {
  const lines = invalidLines.slice(0, PREVIEW_LINE_LIMIT).map((line) => ({
    lineNumber: line.lineNumber,
    typeLabel: lineTypeLabel(line.kind),
    text: line.text,
  }));
  return {
    lines,
    overflow: Math.max(0, invalidLines.length - PREVIEW_LINE_LIMIT),
  };
}

function readyText(script: InvoiceParsedScriptResult): string {
  const words = `${script.billableWords} words`;
  const count = script.invalidLines.length;
  return count > 0 ? `${words} · ${count} to review` : words;
}

function unavailableReason(script: InvoiceUnavailableScriptResult): string {
  return UNAVAILABLE_REASONS[script.reason] ?? 'Script is unavailable.';
}

function applyFooter(
  result: InvoiceProjectScriptParsingResult,
  totalBillableWords: number,
): FooterView {
  const original = result.request.collection === 'original';
  return {
    primary: {
      label: 'Apply to Invoice',
      altText: original
        ? `Apply ${totalBillableWords} words to Translation for project ${result.project.number}`
        : `Apply ${totalBillableWords} words to Voice Over for project ${result.project.number}`,
      style: 'filled',
      action: {
        functionName: APPLY_INVOICE_PROJECT_SCRIPT_RESULTS_ACTION,
        parameters: {
          ...invoiceProjectIdentityParameters(result.request),
          [PARSING_SIGNATURE_PARAMETER]: result.parsingSignature,
        },
        spinner: true,
      },
    },
  };
}
