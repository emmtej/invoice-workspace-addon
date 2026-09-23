import { getErrorMessage } from '../../shared/errors';
import {
  readDriveIdParameter,
  readStringFormInput,
} from '../../shared/addon-event';
import {
  buildNotificationResponse,
  pushCardResponse,
  updateCardResponse,
} from '../../ui/navigation';
import {
  INVOICE_DOCUMENT_ID_PARAMETER,
  INVOICE_SETTINGS_FIELDS,
} from './invoice-action-ids';
import type {
  InvoiceCurrency,
  InvoiceRateSettings,
  InvoiceRateSettingsStore,
} from './invoice-settings';
import { toInvoiceSettingsView } from './ui/invoice-settings-view';
import { buildInvoiceSettingsCard } from './ui/invoice-settings-card';

export interface InvoiceSettingsActionDependencies {
  store: InvoiceRateSettingsStore;
}

function renderSettingsCard(
  settings: InvoiceRateSettings,
  invoiceDocumentId: string,
): GoogleAppsScript.Card_Service.Card {
  return buildInvoiceSettingsCard(
    toInvoiceSettingsView(settings, invoiceDocumentId),
  );
}

export function readInvoiceSettingsDocumentId(
  event: GoogleAppsScript.Addons.EventObject,
): string {
  return readDriveIdParameter(
    event.commonEventObject?.parameters,
    INVOICE_DOCUMENT_ID_PARAMETER,
    'Invoice document context is missing. Reload the card.',
  );
}

export function handleOpenInvoiceSettings(
  event: GoogleAppsScript.Addons.EventObject,
  dependencies: InvoiceSettingsActionDependencies,
): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    const documentId = readInvoiceSettingsDocumentId(event);
    return pushCardResponse(
      renderSettingsCard(dependencies.store.get(), documentId),
    );
  } catch (error) {
    return buildNotificationResponse(
      `Could not load Invoice settings. ${getErrorMessage(error)}`,
    );
  }
}

export function handleSaveInvoiceSettings(
  event: GoogleAppsScript.Addons.EventObject,
  dependencies: InvoiceSettingsActionDependencies,
): GoogleAppsScript.Card_Service.ActionResponse {
  let documentId: string;
  try {
    documentId = readInvoiceSettingsDocumentId(event);
  } catch (error) {
    return buildNotificationResponse(getErrorMessage(error));
  }

  let settings: InvoiceRateSettings;
  try {
    settings = dependencies.store.set({
      translationRate: readStringFormInput(
        event,
        INVOICE_SETTINGS_FIELDS.translationRate,
      ),
      voiceOverRate: readStringFormInput(
        event,
        INVOICE_SETTINGS_FIELDS.voiceOverRate,
      ),
      currency: readStringFormInput(
        event,
        INVOICE_SETTINGS_FIELDS.currency,
      ) as InvoiceCurrency,
    });
  } catch (error) {
    return buildNotificationResponse(getErrorMessage(error));
  }

  const message = 'Invoice settings saved.';
  try {
    return updateCardResponse(renderSettingsCard(settings, documentId), {
      message,
      stateChanged: true,
    });
  } catch (_error) {
    return buildNotificationResponse(
      `${message} Reload the Invoice card to refresh it.`,
      { stateChanged: true },
    );
  }
}
