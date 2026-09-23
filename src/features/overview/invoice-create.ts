import { CREATE_INVOICE_DOCUMENT_PARAMETER } from './invoice-card';
import { createInvoiceDraft } from './invoice-mutation';
import { loadOverviewWorkspace } from './workspace';
import { type WorkspaceDriveReader } from './workspace-reader';
import { getErrorLogContext } from '../../shared/logging';
import { logEvent } from '../../diagnostics/logging';
import type { InvoiceMutationDependencies } from './invoice-mutation';
import { buildOverviewHomeCard } from './ui/overview-home-card';
import { toOverviewHomeView } from './ui/overview-home-view';
import {
  buildNotificationResponse,
  updateCardResponse,
} from '../../ui/navigation';

export const CREATE_INVOICE_LOCK_MESSAGE =
  'Workspace is busy. Retry invoice creation.';

const INVALID_INVOICE_REQUEST =
  'Invoice request is invalid. Reload the card and try again.';

export interface CreateInvoiceParameters {
  documentId: string;
}

export function readCreateInvoiceParameters(
  event: GoogleAppsScript.Addons.EventObject,
): CreateInvoiceParameters {
  const documentId =
    event.commonEventObject?.parameters?.[CREATE_INVOICE_DOCUMENT_PARAMETER];
  if (!documentId) {
    throw new Error('Missing or invalid invoice parameters.');
  }
  return { documentId };
}

export interface CreateInvoiceDependencies extends InvoiceMutationDependencies {
  withLock<T>(operation: () => T): T;
  loadWorkspace: typeof loadOverviewWorkspace;
  reader: WorkspaceDriveReader;
}

export interface CreateInvoiceResponseDependencies {
  loadWorkspace: typeof loadOverviewWorkspace;
  reader: WorkspaceDriveReader;
}

export function buildCreateInvoiceResponse(
  documentId: string,
  message: string,
  changed: boolean,
  dependencies: CreateInvoiceResponseDependencies,
): GoogleAppsScript.Card_Service.ActionResponse {
  const workspace = dependencies.loadWorkspace(documentId, dependencies.reader);
  return updateCardResponse(
    buildOverviewHomeCard(toOverviewHomeView(workspace)),
    {
      message,
      stateChanged: changed,
    },
  );
}

function buildCreateInvoiceFailure(
  documentId: string,
  changed: boolean,
  dependencies: CreateInvoiceResponseDependencies,
): GoogleAppsScript.Card_Service.ActionResponse {
  const message = 'Invoice creation failed. Check Drive access and retry.';
  try {
    return buildCreateInvoiceResponse(
      documentId,
      message,
      changed,
      dependencies,
    );
  } catch (_error) {
    return buildNotificationResponse(message, { stateChanged: changed });
  }
}

export function handleCreateInvoice(
  event: GoogleAppsScript.Addons.EventObject,
  dependencies: CreateInvoiceDependencies,
): GoogleAppsScript.Card_Service.ActionResponse {
  let parameters: CreateInvoiceParameters;
  try {
    parameters = readCreateInvoiceParameters(event);
  } catch (_error) {
    return buildNotificationResponse(INVALID_INVOICE_REQUEST);
  }

  const refresh: CreateInvoiceResponseDependencies = {
    loadWorkspace: dependencies.loadWorkspace,
    reader: dependencies.reader,
  };
  let changed = false;
  try {
    const result = dependencies.withLock(() =>
      createInvoiceDraft(parameters.documentId, dependencies, {
        handler: 'onCreateInvoice',
      }),
    );
    changed = result.changed;
    return buildCreateInvoiceResponse(
      parameters.documentId,
      result.message,
      result.changed,
      refresh,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === CREATE_INVOICE_LOCK_MESSAGE
    ) {
      logEvent('invoice.create.failed', 'warning', {
        documentId: parameters.documentId,
        handler: 'onCreateInvoice',
        reason: 'lock-unavailable',
      });
      return buildNotificationResponse(CREATE_INVOICE_LOCK_MESSAGE);
    }
    logEvent('invoice.create.failed', 'error', {
      documentId: parameters.documentId,
      handler: 'onCreateInvoice',
      reason: changed ? 'refresh-failed' : 'mutation-failed',
      changed,
      ...getErrorLogContext(error),
    });
    return buildCreateInvoiceFailure(parameters.documentId, changed, refresh);
  }
}
