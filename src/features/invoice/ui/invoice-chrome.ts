import type { PrimaryFooterButtonView } from '../../../ui/models';
import {
  INVOICE_DOCUMENT_ID_PARAMETER,
  PROJECT_FOLDER_ID_PARAMETER,
  PROJECT_NUMBER_PARAMETER,
  PROJECT_TITLE_PARAMETER,
  SCRIPT_COLLECTION_PARAMETER,
} from '../invoice-action-ids';
import { getInvoiceDocumentUrl } from '../invoice-document';
import type { InvoiceScriptCollection } from '../invoice-projects';

export function openInvoiceFooterButton(
  documentId: string,
): PrimaryFooterButtonView {
  return {
    label: 'Open Invoice',
    altText: 'Open the Invoice document',
    style: 'filled',
    openLink: {
      url: getInvoiceDocumentUrl(documentId),
      openAs: 'full-size',
    },
  };
}

export function invoiceProjectIdentityParameters(request: {
  invoiceDocumentId: string;
  projectFolderId: string;
  projectNumber: number;
  projectTitle: string;
  collection: InvoiceScriptCollection;
}): Record<string, string> {
  return {
    [INVOICE_DOCUMENT_ID_PARAMETER]: request.invoiceDocumentId,
    [PROJECT_FOLDER_ID_PARAMETER]: request.projectFolderId,
    [PROJECT_NUMBER_PARAMETER]: String(request.projectNumber),
    [PROJECT_TITLE_PARAMETER]: request.projectTitle,
    [SCRIPT_COLLECTION_PARAMETER]: request.collection,
  };
}
