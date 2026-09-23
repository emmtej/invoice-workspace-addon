import { handleApplyInvoiceProjectScriptResults } from '../features/invoice/invoice-apply-actions';
import { handleFinalizeInvoice } from '../features/invoice/invoice-finalize-actions';
import {
  handleChangeInvoiceScriptLineAuditPage,
  handleOpenInvoiceProjectScripts,
  handleOpenInvoiceScriptLineAudit,
} from '../features/invoice/invoice-parse-actions';
import {
  handleChangeInvoicePage,
  handleChangeInvoiceProjectScriptsPage,
} from '../features/invoice/invoice-page-actions';
import {
  handleOpenInvoiceSettings,
  handleSaveInvoiceSettings,
} from '../features/invoice/invoice-settings-actions';
import {
  createApplyInvoiceProjectScriptResultsDependencies,
  createFinalizeInvoiceDependencies,
  createInvoicePageReader,
  createInvoiceScriptActionDependencies,
  createInvoiceSettingsActionDependencies,
} from '../runtime/apps-script/invoice-dependencies';

export function onChangeInvoicePage(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleChangeInvoicePage(event, createInvoicePageReader());
}

export function onOpenInvoiceProjectScripts(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  const dependencies = createInvoiceScriptActionDependencies();
  return handleOpenInvoiceProjectScripts(
    event,
    dependencies.reader,
    dependencies.readContent,
  );
}

export function onChangeInvoiceProjectScriptsPage(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  const dependencies = createInvoiceScriptActionDependencies();
  return handleChangeInvoiceProjectScriptsPage(
    event,
    dependencies.reader,
    dependencies.readContent,
  );
}

export function onOpenInvoiceScriptLineAudit(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  const dependencies = createInvoiceScriptActionDependencies();
  return handleOpenInvoiceScriptLineAudit(
    event,
    dependencies.reader,
    dependencies.readContent,
  );
}

export function onChangeInvoiceScriptLineAuditPage(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  const dependencies = createInvoiceScriptActionDependencies();
  return handleChangeInvoiceScriptLineAuditPage(
    event,
    dependencies.reader,
    dependencies.readContent,
  );
}

export function onApplyInvoiceProjectScriptResults(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleApplyInvoiceProjectScriptResults(
    event,
    createApplyInvoiceProjectScriptResultsDependencies(),
  );
}

export function onFinalizeInvoice(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleFinalizeInvoice(event, createFinalizeInvoiceDependencies());
}

export function onOpenInvoiceSettings(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleOpenInvoiceSettings(
    event,
    createInvoiceSettingsActionDependencies(),
  );
}

export function onSaveInvoiceSettings(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleSaveInvoiceSettings(
    event,
    createInvoiceSettingsActionDependencies(),
  );
}
