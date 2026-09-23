import { buildNotificationResponse } from '../ui/navigation';
import { handleInitializeProject } from '../features/overview/initialize-project';
import { handleCreateInvoice } from '../features/overview/invoice-create';
import {
  handleCancelClearProjectScriptProperties,
  handleClearProjectScriptProperties,
  handleOpenAdditionalCharactersEditor,
  handleOpenClearProjectScriptPropertiesConfirmation,
  handleOpenOverviewSettings,
  handleSaveAdditionalCharacters,
  handleToggleAdditionalCharacterCheck,
} from '../features/overview/overview-settings-actions';
import {
  createClearProjectScriptPropertiesActionDependencies,
  createCreateInvoiceDependencies,
  createInitializeProjectDependencies,
  createOverviewSettingsActionDependencies,
} from '../runtime/apps-script/overview-dependencies';

export function onRequestDocsFileScope(): GoogleAppsScript.Card_Service.EditorFileScopeActionResponse {
  return CardService.newEditorFileScopeActionResponseBuilder()
    .requestFileScopeForActiveDocument()
    .build();
}

export function onMissingProjectLink(): GoogleAppsScript.Card_Service.ActionResponse {
  return buildNotificationResponse('No link available for this project.');
}

export function onInitializeProject(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleInitializeProject(event, createInitializeProjectDependencies());
}

export function onCreateInvoice(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleCreateInvoice(event, createCreateInvoiceDependencies());
}

export function onOpenOverviewSettings(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleOpenOverviewSettings(
    event,
    createOverviewSettingsActionDependencies(),
  );
}

export function onToggleAdditionalCharacterCheck(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleToggleAdditionalCharacterCheck(
    event,
    createOverviewSettingsActionDependencies(),
  );
}

export function onOpenAdditionalCharactersEditor(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleOpenAdditionalCharactersEditor(
    event,
    createOverviewSettingsActionDependencies(),
  );
}

export function onSaveAdditionalCharacters(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleSaveAdditionalCharacters(
    event,
    createOverviewSettingsActionDependencies(),
  );
}

export function onOpenClearProjectScriptPropertiesConfirmation(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleOpenClearProjectScriptPropertiesConfirmation(event);
}

export function onCancelClearProjectScriptProperties(
  _event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleCancelClearProjectScriptProperties();
}

export function onClearProjectScriptProperties(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleClearProjectScriptProperties(
    event,
    createClearProjectScriptPropertiesActionDependencies(),
  );
}
