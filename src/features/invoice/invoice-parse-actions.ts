import { readInvoiceProjectScriptsRequest } from './invoice-action-parameters';
import { getErrorMessage } from '../../shared/errors';
import { getErrorLogContext } from '../../shared/logging';
import { logEvent } from '../../diagnostics/logging';
import { createActionProcessBudget } from '../../shared/action-process-budget';
import { DRIVE_ID_PATTERN } from '../../shared/workspace-domain';
import { toInvoiceErrorView } from './ui/invoice-error-view';
import { buildLineAuditCard } from './ui/line-audit-card';
import { toLineAuditView, type LineAuditFilter } from './ui/line-audit-view';
import { buildProjectScriptsCard } from './ui/project-scripts-card';
import { toProjectScriptsView } from './ui/project-scripts-view';
import { buildErrorCard } from '../../ui/chrome';
import { pushCardResponse, updateCardResponse } from '../../ui/navigation';
import {
  SCRIPT_FILE_ID_PARAMETER,
  SCRIPT_LINE_AUDIT_FILTER_PARAMETER,
} from './invoice-action-ids';
import {
  parseInvoiceProjectScriptCollection,
  parseInvoiceScriptLineAudit,
  type InvoiceScriptContentReader,
} from './invoice-script-results';
import {
  loadInvoiceProjectScripts,
  type InvoiceProjectScriptsRequest,
  type InvoiceWorkspaceReader,
} from './invoice-workspace';

export function handleOpenInvoiceProjectScripts(
  event: GoogleAppsScript.Addons.EventObject,
  reader: InvoiceWorkspaceReader,
  readContent: InvoiceScriptContentReader,
): GoogleAppsScript.Card_Service.ActionResponse {
  const budget = createActionProcessBudget();
  let invoiceDocumentId: string | undefined;
  try {
    const request = readInvoiceProjectScriptsRequest(event);
    invoiceDocumentId = request.invoiceDocumentId;
    const list = loadInvoiceProjectScripts(request, reader);
    const result = parseInvoiceProjectScriptCollection(
      request,
      list,
      readContent,
      budget,
    );
    return pushCardResponse(
      buildProjectScriptsCard(toProjectScriptsView(result)),
    );
  } catch (error) {
    logEvent('invoice.project-scripts.failed', 'error', {
      invoiceDocumentId: invoiceDocumentId ?? null,
      ...getErrorLogContext(error),
    });
    return pushCardResponse(
      buildErrorCard(
        toInvoiceErrorView(
          `Could not parse character scripts. ${getErrorMessage(error)}`,
          'scripts',
          invoiceDocumentId,
        ),
      ),
    );
  }
}

export interface InvoiceScriptLineAuditRequest {
  projectScripts: InvoiceProjectScriptsRequest;
  scriptFileId: string;
  filter: LineAuditFilter;
}

export function readInvoiceScriptLineAuditRequest(
  event: GoogleAppsScript.Addons.EventObject,
): InvoiceScriptLineAuditRequest {
  const projectScripts = readInvoiceProjectScriptsRequest(event);
  const parameters = event.commonEventObject?.parameters ?? {};
  const scriptFileId = parameters[SCRIPT_FILE_ID_PARAMETER];
  if (!scriptFileId || !DRIVE_ID_PATTERN.test(scriptFileId)) {
    throw new Error('Missing or invalid script file id.');
  }
  return {
    projectScripts,
    scriptFileId,
    filter: readInvoiceScriptLineAuditFilter(event),
  };
}

function readInvoiceScriptLineAuditFilter(
  event: GoogleAppsScript.Addons.EventObject,
): LineAuditFilter {
  const formValue =
    event.commonEventObject?.formInputs?.[SCRIPT_LINE_AUDIT_FILTER_PARAMETER]
      ?.stringInputs?.value?.[0];
  const parameterValue =
    event.commonEventObject?.parameters?.[SCRIPT_LINE_AUDIT_FILTER_PARAMETER];
  const raw =
    typeof formValue === 'string'
      ? formValue
      : typeof parameterValue === 'string'
        ? parameterValue
        : 'all';
  if (
    raw === 'all' ||
    raw === 'needs-review' ||
    raw === 'non-billable' ||
    raw === 'billable'
  ) {
    return raw;
  }
  throw new Error('Missing or invalid parsed-line filter.');
}

function handleInvoiceScriptLineAudit(
  event: GoogleAppsScript.Addons.EventObject,
  reader: InvoiceWorkspaceReader,
  readContent: InvoiceScriptContentReader,
  navigationMode: 'push' | 'update',
): GoogleAppsScript.Card_Service.ActionResponse {
  let invoiceDocumentId: string | undefined;
  try {
    const request = readInvoiceScriptLineAuditRequest(event);
    invoiceDocumentId = request.projectScripts.invoiceDocumentId;
    const list = loadInvoiceProjectScripts(request.projectScripts, reader);
    const result = parseInvoiceScriptLineAudit(
      request.projectScripts,
      list,
      request.scriptFileId,
      readContent,
    );
    const card = buildLineAuditCard(toLineAuditView(result, request.filter));
    return navigateInvoiceCard(card, navigationMode);
  } catch (error) {
    logEvent('invoice.script-line-audit.failed', 'error', {
      invoiceDocumentId: invoiceDocumentId ?? null,
      ...getErrorLogContext(error),
    });
    return navigateInvoiceCard(
      buildErrorCard(
        toInvoiceErrorView(
          `Could not show parsed lines. ${getErrorMessage(error)}`,
          'lines',
          invoiceDocumentId,
        ),
      ),
      navigationMode,
    );
  }
}

export function handleOpenInvoiceScriptLineAudit(
  event: GoogleAppsScript.Addons.EventObject,
  reader: InvoiceWorkspaceReader,
  readContent: InvoiceScriptContentReader,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleInvoiceScriptLineAudit(event, reader, readContent, 'push');
}

export function handleChangeInvoiceScriptLineAuditPage(
  event: GoogleAppsScript.Addons.EventObject,
  reader: InvoiceWorkspaceReader,
  readContent: InvoiceScriptContentReader,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleInvoiceScriptLineAudit(event, reader, readContent, 'update');
}

function navigateInvoiceCard(
  card: GoogleAppsScript.Card_Service.Card,
  navigationMode: 'push' | 'update',
): GoogleAppsScript.Card_Service.ActionResponse {
  return navigationMode === 'push'
    ? pushCardResponse(card)
    : updateCardResponse(card);
}
