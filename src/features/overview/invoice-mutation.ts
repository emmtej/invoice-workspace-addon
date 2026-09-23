import {
  getInvoiceDraftValidationError,
  getInvoiceVoiceActor,
  renderInvoiceDraft,
  type InvoiceDraftProject,
} from './invoice-draft';
import {
  classifyInvoiceDocuments,
  type InvoiceDocumentRecord,
} from './invoice-model';
import { getErrorLogContext, type LogContext } from '../../shared/logging';
import { logEvent } from '../../diagnostics/logging';

export interface InvoiceMutationDependencies {
  loadItems(documentId: string): InvoiceDraftProject[];
  getOverviewParent(documentId: string): { id: string; name: string };
  listInvoiceCandidates(parentFolderId: string): InvoiceDocumentRecord[];
  createInvoiceDocument(parentFolderId: string): InvoiceDocumentRecord;
  writeInvoiceBody(documentId: string, body: string): void;
  trashDocument(documentId: string): void;
  formatToday(): string;
}

export interface InvoiceMutationResult {
  message: string;
  changed: boolean;
}

export function createInvoiceDraft(
  documentId: string,
  dependencies: InvoiceMutationDependencies,
  logContext: LogContext = {},
): InvoiceMutationResult {
  const context: LogContext = { ...logContext, documentId };

  const parent = dependencies.getOverviewParent(documentId);
  context.parentFolderId = parent.id;

  let candidates: InvoiceDocumentRecord[];
  try {
    candidates = dependencies.listInvoiceCandidates(parent.id);
  } catch (error) {
    logEvent('invoice.create.failed', 'error', {
      ...context,
      reason: 'lookup-failed',
      ...getErrorLogContext(error),
    });
    return {
      message: 'Invoice status is unavailable. Nothing was created.',
      changed: false,
    };
  }

  const state = classifyInvoiceDocuments(candidates);
  const duplicateCount =
    state.status === 'matched' ? state.duplicates.length : 0;
  if (duplicateCount > 0) {
    logEvent('invoice.create.lookup-completed', 'warning', {
      ...context,
      status: state.status,
      candidateCount: candidates.length,
      preferredDocumentId:
        state.status === 'matched' ? state.document.id : null,
      duplicateCount,
    });
  }

  if (state.status === 'matched') {
    return {
      message: 'Invoice already exists.',
      changed: false,
    };
  }

  const items = dependencies.loadItems(documentId);
  const validationError = getInvoiceDraftValidationError(items);
  if (validationError) {
    logEvent('invoice.create.failed', 'warning', {
      ...context,
      reason: 'invalid-overview',
      itemCount: items.length,
      message: validationError,
    });
    return {
      message: validationError,
      changed: false,
    };
  }

  let body: string;
  try {
    body = renderInvoiceDraft({
      voiceActor: getInvoiceVoiceActor(items),
      todayText: dependencies.formatToday(),
      projects: items,
    });
  } catch (error) {
    logEvent('invoice.create.failed', 'error', {
      ...context,
      reason: 'render-failed',
      ...getErrorLogContext(error),
    });
    throw error;
  }

  const created = dependencies.createInvoiceDocument(parent.id);

  try {
    dependencies.writeInvoiceBody(created.id, body);
  } catch (error) {
    logEvent('invoice.create.failed', 'error', {
      ...context,
      reason: 'write-failed',
      createdDocumentId: created.id,
      ...getErrorLogContext(error),
    });
    try {
      dependencies.trashDocument(created.id);
      logEvent('invoice.create.trashed', 'warning', {
        ...context,
        createdDocumentId: created.id,
      });
    } catch (trashError) {
      logEvent('invoice.create.failed', 'error', {
        ...context,
        reason: 'trash-failed',
        createdDocumentId: created.id,
        ...getErrorLogContext(trashError),
      });
    }
    throw error;
  }

  return {
    message: 'Invoice draft created.',
    changed: true,
  };
}
