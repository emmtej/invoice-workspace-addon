import {
  readParsingSignature,
  readPageParameter,
  readInvoiceProjectScriptsRequest,
} from './invoice-action-parameters';
import { getErrorMessage } from '../../shared/errors';
import { getErrorLogContext } from '../../shared/logging';
import { logEvent } from '../../diagnostics/logging';
import { createActionProcessBudget } from '../../shared/action-process-budget';
import { readDriveIdParameter } from '../../shared/addon-event';
import { toInvoiceErrorView } from './ui/invoice-error-view';
import { buildInvoiceHomeCard } from './ui/invoice-home-card';
import { toInvoiceHomeView } from './ui/invoice-home-view';
import { buildProjectScriptsCard } from './ui/project-scripts-card';
import { toProjectScriptsView } from './ui/project-scripts-view';
import { buildErrorCard } from '../../ui/chrome';
import { updateCardResponse } from '../../ui/navigation';
import {
  INVOICE_DOCUMENT_ID_PARAMETER,
  INVOICE_PAGE_PARAMETER,
  SCRIPT_RESULTS_PAGE_PARAMETER,
} from './invoice-action-ids';
import {
  parseInvoiceProjectScriptCollection,
  type InvoiceScriptContentReader,
} from './invoice-script-results';
import {
  loadInvoiceProjectScripts,
  loadInvoiceWorkspace,
  type InvoiceProjectScriptsRequest,
  type InvoiceWorkspaceReader,
} from './invoice-workspace';

export interface InvoicePageRequest {
  invoiceDocumentId: string;
  page: number;
}

export function readInvoicePageRequest(
  event: GoogleAppsScript.Addons.EventObject,
): InvoicePageRequest {
  const parameters = event.commonEventObject?.parameters ?? {};
  const invoiceDocumentId = readDriveIdParameter(
    parameters,
    INVOICE_DOCUMENT_ID_PARAMETER,
    'Missing or invalid Invoice document id.',
  );
  return {
    invoiceDocumentId,
    page: readPageParameter(
      parameters,
      INVOICE_PAGE_PARAMETER,
      'Missing or invalid Invoice project page.',
    ),
  };
}

export function handleChangeInvoicePage(
  event: GoogleAppsScript.Addons.EventObject,
  reader: InvoiceWorkspaceReader,
): GoogleAppsScript.Card_Service.ActionResponse {
  let invoiceDocumentId: string | undefined;
  try {
    const request = readInvoicePageRequest(event);
    invoiceDocumentId = request.invoiceDocumentId;
    const workspace = loadInvoiceWorkspace(invoiceDocumentId, reader);
    const card = buildInvoiceHomeCard(
      toInvoiceHomeView(workspace, request.page),
    );
    return updateCardResponse(card);
  } catch (error) {
    logEvent('invoice.page.change-failed', 'error', {
      invoiceDocumentId: invoiceDocumentId ?? null,
      ...getErrorLogContext(error),
    });
    return updateCardResponse(
      buildErrorCard(
        toInvoiceErrorView(
          `Could not show Invoice projects. ${getErrorMessage(error)}`,
          'projects',
          invoiceDocumentId,
        ),
      ),
    );
  }
}

export interface InvoiceProjectScriptsPageRequest {
  projectScripts: InvoiceProjectScriptsRequest;
  parsingSignature: string;
  page: number;
}

export function readInvoiceProjectScriptsPageRequest(
  event: GoogleAppsScript.Addons.EventObject,
): InvoiceProjectScriptsPageRequest {
  return {
    projectScripts: readInvoiceProjectScriptsRequest(event),
    parsingSignature: readParsingSignature(event),
    page: readPageParameter(
      event.commonEventObject?.parameters ?? {},
      SCRIPT_RESULTS_PAGE_PARAMETER,
      'Missing or invalid parsing-results page.',
    ),
  };
}

export function handleChangeInvoiceProjectScriptsPage(
  event: GoogleAppsScript.Addons.EventObject,
  reader: InvoiceWorkspaceReader,
  readContent: InvoiceScriptContentReader,
): GoogleAppsScript.Card_Service.ActionResponse {
  const budget = createActionProcessBudget();
  let invoiceDocumentId: string | undefined;
  try {
    const request = readInvoiceProjectScriptsPageRequest(event);
    invoiceDocumentId = request.projectScripts.invoiceDocumentId;
    const list = loadInvoiceProjectScripts(request.projectScripts, reader);
    const result = parseInvoiceProjectScriptCollection(
      request.projectScripts,
      list,
      readContent,
      budget,
    );
    if (result.parsingSignature !== request.parsingSignature) {
      throw new Error('Scripts changed. Parse them again before paging.');
    }
    const card = buildProjectScriptsCard(
      toProjectScriptsView(result, request.page),
    );
    return updateCardResponse(card);
  } catch (error) {
    logEvent('invoice.project-scripts.page-change-failed', 'error', {
      invoiceDocumentId: invoiceDocumentId ?? null,
      ...getErrorLogContext(error),
    });
    return updateCardResponse(
      buildErrorCard(
        toInvoiceErrorView(
          `Could not show parsing results. ${getErrorMessage(error)}`,
          'results',
          invoiceDocumentId,
        ),
      ),
    );
  }
}
