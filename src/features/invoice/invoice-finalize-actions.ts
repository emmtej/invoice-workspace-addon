import { getErrorMessage } from '../../shared/errors';
import { getErrorLogContext } from '../../shared/logging';
import { logEvent } from '../../diagnostics/logging';
import { readDriveIdParameter } from '../../shared/addon-event';
import { INVOICE_DOCUMENT_ID_PARAMETER } from './invoice-action-ids';
import { buildInvoiceHomeCard } from './ui/invoice-home-card';
import { toInvoiceHomeView } from './ui/invoice-home-view';
import {
  loadInvoiceWorkspace,
  type InvoiceWorkspaceReader,
  type InvoiceWorkspaceWriter,
} from './invoice-workspace';
import type { InvoiceRateSettingsStore } from './invoice-settings';
import {
  buildNotificationResponse,
  updateCardResponse,
} from '../../ui/navigation';

export interface FinalizeInvoiceDependencies {
  reader: InvoiceWorkspaceReader;
  writer: Pick<InvoiceWorkspaceWriter, 'finalizeInvoice'>;
  settingsStore: InvoiceRateSettingsStore;
  withLock<T>(operation: () => T): T;
}

export function handleFinalizeInvoice(
  event: GoogleAppsScript.Addons.EventObject,
  dependencies: FinalizeInvoiceDependencies,
): GoogleAppsScript.Card_Service.ActionResponse {
  let invoiceDocumentId: string;
  try {
    invoiceDocumentId = readDriveIdParameter(
      event.commonEventObject?.parameters,
      INVOICE_DOCUMENT_ID_PARAMETER,
      'Missing or invalid Invoice document id.',
    );
  } catch {
    return buildNotificationResponse(
      'Missing or invalid Invoice document id.',
      { stateChanged: false },
    );
  }

  let invoiceTotalCost: string;
  try {
    const result = dependencies.withLock(() =>
      dependencies.writer.finalizeInvoice(
        invoiceDocumentId,
        dependencies.settingsStore.get(),
      ),
    );
    invoiceTotalCost = result.invoiceTotalCost;
  } catch (error) {
    logEvent('invoice.finalize-failed', 'error', {
      invoiceDocumentId,
      ...getErrorLogContext(error),
    });
    return buildNotificationResponse(
      `Could not finalize Invoice. ${getErrorMessage(error)}`,
      { stateChanged: false },
    );
  }

  const message = `Invoice finalized. Total cost: ${invoiceTotalCost}.`;
  try {
    const workspace = loadInvoiceWorkspace(
      invoiceDocumentId,
      dependencies.reader,
    );
    return updateCardResponse(
      buildInvoiceHomeCard(toInvoiceHomeView(workspace)),
      { message, stateChanged: true },
    );
  } catch (error) {
    logEvent('invoice.finalize-refresh-failed', 'error', {
      invoiceDocumentId,
      ...getErrorLogContext(error),
    });
    return buildNotificationResponse(
      `${message} Reload the Invoice card to refresh it.`,
      { stateChanged: true },
    );
  }
}
