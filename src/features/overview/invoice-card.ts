import {
  getInvoiceDraftValidationError,
  type InvoiceDraftProject,
} from './invoice-draft';
import { type InvoiceDocumentState } from './invoice-model';

export const CREATE_INVOICE_ACTION = 'onCreateInvoice';
export const CREATE_INVOICE_DOCUMENT_PARAMETER = 'overviewDocumentId';

export type InvoiceFooterPresentation =
  | { kind: 'create' }
  | { kind: 'open'; url: string };

export interface InvoiceCardPresentation {
  warning?: string;
  footer?: InvoiceFooterPresentation;
}

export function getInvoiceCardPresentation(
  invoice: InvoiceDocumentState,
  projects: readonly InvoiceDraftProject[] = [],
): InvoiceCardPresentation {
  if (invoice.status === 'matched') {
    const url = invoice.document.webViewLink;
    if (!url) {
      return {};
    }
    return {
      footer: {
        kind: 'open',
        url,
      },
    };
  }
  if (invoice.status === 'unknown') {
    return {
      warning: 'Invoice status is unavailable. Reload the card and try again.',
    };
  }
  const validationError = getInvoiceDraftValidationError(projects);
  if (validationError) {
    return { warning: validationError };
  }
  return { footer: { kind: 'create' } };
}
