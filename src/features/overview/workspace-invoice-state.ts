import type { WorkspaceDriveReader } from './workspace-reader';
import {
  classifyInvoiceDocuments,
  type InvoiceDocumentState,
} from './invoice-model';
import { getErrorLogContext, type LogContext } from '../../shared/logging';
import { logEvent } from '../../diagnostics/logging';

export function unknownInvoice(
  reason: Extract<InvoiceDocumentState, { status: 'unknown' }>['reason'],
): InvoiceDocumentState {
  return { status: 'unknown', reason };
}

export function loadInvoiceState(
  documentId: string,
  parentFolderId: string,
  drive: Pick<WorkspaceDriveReader, 'listInvoiceCandidates'>,
  logContext: LogContext,
): InvoiceDocumentState {
  try {
    const documents = drive.listInvoiceCandidates(parentFolderId);
    const state = classifyInvoiceDocuments(documents);
    const duplicateCount =
      state.status === 'matched' ? state.duplicates.length : 0;
    if (duplicateCount > 0) {
      logEvent('invoice.lookup.completed', 'warning', {
        ...logContext,
        documentId,
        parentFolderId,
        status: state.status,
        candidateCount: documents.length,
        preferredDocumentId:
          state.status === 'matched' ? state.document.id : null,
        duplicateCount,
      });
    }
    return state;
  } catch (error) {
    logEvent('invoice.lookup.failed', 'error', {
      ...logContext,
      documentId,
      parentFolderId,
      ...getErrorLogContext(error),
    });
    return unknownInvoice('lookup-failed');
  }
}
