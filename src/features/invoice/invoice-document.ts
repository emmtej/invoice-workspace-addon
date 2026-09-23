import { INVOICE_DOCUMENT_NAME } from '../../shared/workspace-domain';
import { googleDocUrl } from '../../shared/google-doc-url';

export function isInvoiceDocumentName(name: string): boolean {
  return name === INVOICE_DOCUMENT_NAME;
}

export function getInvoiceDocumentUrl(documentId: string): string {
  return googleDocUrl(documentId);
}
