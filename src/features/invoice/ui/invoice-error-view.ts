import type { ErrorCardView } from '../../../ui/models';
import { openInvoiceFooterButton } from './invoice-chrome';

export type InvoiceErrorContext =
  | 'load'
  | 'projects'
  | 'scripts'
  | 'results'
  | 'lines';

const SUBTITLES: Record<InvoiceErrorContext, string> = {
  load: 'Could not load',
  projects: 'Could not show projects',
  scripts: 'Could not parse scripts',
  results: 'Could not show results',
  lines: 'Could not show lines',
};

const RESTART_RECOVERY =
  'In Drive, select another file, then Invoice to restart.';
const HOME_RETRY_RECOVERY =
  'In Drive, select another file, then Invoice to retry.';
const SCRIPTS_RETRY_RECOVERY =
  'Use Back, then choose Original or Translated to retry.';
const LINES_RETRY_RECOVERY =
  'Use Back to reopen results. Reparse from Invoice if scripts changed.';

function recoveryText(
  context: InvoiceErrorContext,
  hasDocumentId: boolean,
): string {
  if (!hasDocumentId) {
    return RESTART_RECOVERY;
  }
  if (context === 'load' || context === 'projects') {
    return HOME_RETRY_RECOVERY;
  }
  if (context === 'scripts' || context === 'results') {
    return SCRIPTS_RETRY_RECOVERY;
  }
  return LINES_RETRY_RECOVERY;
}

export function toInvoiceErrorView(
  message: string,
  context: InvoiceErrorContext,
  documentId?: string,
): ErrorCardView {
  const view: ErrorCardView = {
    title: 'Invoice',
    subtitle: SUBTITLES[context],
    message,
    recovery: recoveryText(context, Boolean(documentId)),
  };
  if (documentId) {
    view.footer = {
      primary: openInvoiceFooterButton(documentId),
    };
  }
  return view;
}
