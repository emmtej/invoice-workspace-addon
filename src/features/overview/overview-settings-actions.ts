import { getErrorMessage } from '../../shared/errors';
import { getErrorLogContext } from '../../shared/logging';
import { logEvent } from '../../diagnostics/logging';
import {
  formatClearProjectScriptPropertiesResult,
  type ClearProjectScriptPropertiesResult,
} from './project-script-properties';
import {
  parseAdditionalCharacterList,
  type AdditionalCharacterCheckSettings,
  type AdditionalCharacterCheckStore,
} from './overview-settings';
import {
  OVERVIEW_SETTINGS_FIELDS,
  OVERVIEW_SETTINGS_PARAMETERS,
} from './overview-settings-action-ids';
import { buildAdditionalCharactersCard } from './ui/additional-characters-card';
import { toAdditionalCharactersView } from './ui/additional-characters-view';
import { buildConfirmClearCard } from './ui/confirm-clear-card';
import { toConfirmClearView } from './ui/confirm-clear-view';
import { buildOverviewSettingsCard } from './ui/overview-settings-card';
import { toOverviewSettingsView } from './ui/overview-settings-view';
import {
  readDriveIdParameter,
  readStringFormInput,
} from '../../shared/addon-event';
import {
  buildNotificationResponse,
  popAndUpdateCardResponse,
  popCardResponse,
  pushCardResponse,
  updateCardResponse,
} from '../../ui/navigation';

export interface OverviewSettingsActionDependencies {
  store: AdditionalCharacterCheckStore;
}

export interface ClearProjectScriptPropertiesActionDependencies {
  store: AdditionalCharacterCheckStore;
  clearProjectScriptProperties(
    documentId: string,
  ): ClearProjectScriptPropertiesResult;
}

function requireSettingsStore(
  dependencies: Partial<OverviewSettingsActionDependencies>,
): AdditionalCharacterCheckStore {
  if (!dependencies.store) {
    throw new Error('Overview settings store is unavailable.');
  }
  return dependencies.store;
}

function renderSettingsCard(
  settings: AdditionalCharacterCheckSettings,
  documentId: string,
): GoogleAppsScript.Card_Service.Card {
  return buildOverviewSettingsCard(
    toOverviewSettingsView(settings, documentId),
  );
}

export function readOverviewDocumentId(
  event: GoogleAppsScript.Addons.EventObject,
): string {
  return readDriveIdParameter(
    event.commonEventObject?.parameters,
    OVERVIEW_SETTINGS_PARAMETERS.documentId,
    'Overview document context is missing. Reload the card.',
  );
}

export function readBooleanFormInput(
  event: GoogleAppsScript.Addons.EventObject,
  fieldName: string,
): boolean {
  return readStringFormInput(event, fieldName) === 'true';
}

function updateSettingsResponse(
  settings: AdditionalCharacterCheckSettings,
  documentId: string,
  message: string,
  stateChanged = false,
): GoogleAppsScript.Card_Service.ActionResponse {
  return updateCardResponse(
    renderSettingsCard(settings, documentId),
    stateChanged ? { message, stateChanged: true } : { message },
  );
}

function popAndUpdateSettings(
  settings: AdditionalCharacterCheckSettings,
  documentId: string,
  message: string,
): GoogleAppsScript.Card_Service.ActionResponse {
  return popAndUpdateCardResponse(renderSettingsCard(settings, documentId), {
    message,
    stateChanged: true,
  });
}

export function handleOpenOverviewSettings(
  _event: GoogleAppsScript.Addons.EventObject,
  dependencies: Partial<OverviewSettingsActionDependencies>,
): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    const store = requireSettingsStore(dependencies);
    const documentId = readOverviewDocumentId(_event);
    return pushCardResponse(renderSettingsCard(store.get(), documentId));
  } catch (error) {
    return buildNotificationResponse(
      `Could not load Overview settings. ${getErrorMessage(error)}`,
    );
  }
}

export function handleToggleAdditionalCharacterCheck(
  event: GoogleAppsScript.Addons.EventObject,
  dependencies: Partial<OverviewSettingsActionDependencies>,
): GoogleAppsScript.Card_Service.ActionResponse {
  let documentId: string;
  try {
    documentId = readOverviewDocumentId(event);
  } catch (error) {
    return buildNotificationResponse(getErrorMessage(error));
  }
  const store = requireSettingsStore(dependencies);
  const enabled = readBooleanFormInput(event, OVERVIEW_SETTINGS_FIELDS.enabled);
  let settings: AdditionalCharacterCheckSettings;
  try {
    settings = store.setEnabled(enabled);
  } catch (_error) {
    try {
      return updateSettingsResponse(
        store.get(),
        documentId,
        'Could not save additional-character setting.',
      );
    } catch (reloadError) {
      return buildNotificationResponse(
        `Could not save additional-character setting. ${getErrorMessage(reloadError)}`,
      );
    }
  }
  const message = enabled
    ? 'Additional character check is on.'
    : 'Additional character check is off. Saved names were kept.';
  try {
    return updateSettingsResponse(settings, documentId, message, true);
  } catch (_error) {
    return buildNotificationResponse(
      `${message} Reload the Overview card to refresh it.`,
      { stateChanged: true },
    );
  }
}

export function handleOpenAdditionalCharactersEditor(
  _event: GoogleAppsScript.Addons.EventObject,
  dependencies: Partial<OverviewSettingsActionDependencies>,
): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    const store = requireSettingsStore(dependencies);
    const documentId = readOverviewDocumentId(_event);
    return pushCardResponse(
      buildAdditionalCharactersCard(
        toAdditionalCharactersView(store.get().characters, documentId),
      ),
    );
  } catch (error) {
    return buildNotificationResponse(
      `Could not load additional characters. ${getErrorMessage(error)}`,
    );
  }
}

export function handleSaveAdditionalCharacters(
  event: GoogleAppsScript.Addons.EventObject,
  dependencies: Partial<OverviewSettingsActionDependencies>,
): GoogleAppsScript.Card_Service.ActionResponse {
  let documentId: string;
  try {
    documentId = readOverviewDocumentId(event);
  } catch (error) {
    return buildNotificationResponse(getErrorMessage(error));
  }
  const store = requireSettingsStore(dependencies);
  const names = parseAdditionalCharacterList(
    readStringFormInput(event, OVERVIEW_SETTINGS_FIELDS.characters),
  );
  let settings;
  try {
    settings = store.setCharacters(names);
  } catch (error) {
    return buildNotificationResponse(getErrorMessage(error));
  }

  const message = names.length
    ? `Saved ${names.length} additional character${names.length === 1 ? '' : 's'}.`
    : 'Cleared additional characters.';
  try {
    return popAndUpdateSettings(settings, documentId, message);
  } catch (_error) {
    return buildNotificationResponse(
      `${message} Reload the Overview card to refresh it.`,
      { stateChanged: true },
    );
  }
}

export function handleOpenClearProjectScriptPropertiesConfirmation(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    const documentId = readOverviewDocumentId(event);
    return pushCardResponse(
      buildConfirmClearCard(toConfirmClearView(documentId)),
    );
  } catch (error) {
    return buildNotificationResponse(
      `Could not load Overview settings. ${getErrorMessage(error)}`,
    );
  }
}

export function handleCancelClearProjectScriptProperties(): GoogleAppsScript.Card_Service.ActionResponse {
  return popCardResponse();
}

export function handleClearProjectScriptProperties(
  event: GoogleAppsScript.Addons.EventObject,
  dependencies: Partial<ClearProjectScriptPropertiesActionDependencies>,
): GoogleAppsScript.Card_Service.ActionResponse {
  let documentId: string;
  try {
    documentId = readOverviewDocumentId(event);
  } catch (error) {
    return buildNotificationResponse(getErrorMessage(error));
  }
  if (!dependencies.clearProjectScriptProperties) {
    return buildNotificationResponse(
      'Could not clear project script app properties. Drive service is unavailable.',
    );
  }
  let result: ClearProjectScriptPropertiesResult;
  try {
    result = dependencies.clearProjectScriptProperties(documentId);
  } catch (error) {
    logEvent('overview.project-script-properties.clear-failed', 'error', {
      documentId,
      ...getErrorLogContext(error),
    });
    return buildNotificationResponse(
      `Could not clear project script app properties. ${getErrorMessage(error)}`,
    );
  }

  const message = formatClearProjectScriptPropertiesResult(result);
  const stateChanged = result.clearedFileCount > 0;
  try {
    if (!dependencies.store) {
      throw new Error('Overview settings store is unavailable.');
    }
    return popAndUpdateCardResponse(
      renderSettingsCard(dependencies.store.get(), documentId),
      { message, stateChanged },
    );
  } catch (_error) {
    return popCardResponse({ message, stateChanged });
  }
}
