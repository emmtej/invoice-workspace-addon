import {
  readParsingSignature,
  readInvoiceProjectScriptsRequest,
} from './invoice-action-parameters';
import { getErrorMessage } from '../../shared/errors';
import { getErrorLogContext } from '../../shared/logging';
import { logEvent } from '../../diagnostics/logging';
import { createActionProcessBudget } from '../../shared/action-process-budget';
import { buildInvoiceHomeCard } from './ui/invoice-home-card';
import { toInvoiceHomeView } from './ui/invoice-home-view';
import {
  parseInvoiceProjectScriptCollection,
  type InvoiceScriptContentReader,
} from './invoice-script-results';
import {
  loadInvoiceProjectScripts,
  loadInvoiceWorkspace,
  type InvoiceProjectScriptsRequest,
  type InvoiceWorkspaceReader,
  type InvoiceWorkspaceWriter,
} from './invoice-workspace';
import {
  buildNotificationResponse,
  popAndUpdateCardResponse,
} from '../../ui/navigation';

export interface ApplyInvoiceProjectScriptResultsRequest {
  projectScripts: InvoiceProjectScriptsRequest;
  parsingSignature: string;
}

export function readApplyInvoiceProjectScriptResultsRequest(
  event: GoogleAppsScript.Addons.EventObject,
): ApplyInvoiceProjectScriptResultsRequest {
  const projectScripts = readInvoiceProjectScriptsRequest(event);
  return { projectScripts, parsingSignature: readParsingSignature(event) };
}

export interface ApplyInvoiceProjectScriptResultsDependencies {
  reader: InvoiceWorkspaceReader;
  writer: InvoiceWorkspaceWriter;
  readContent: InvoiceScriptContentReader;
  withLock<T>(operation: () => T): T;
}

export function handleApplyInvoiceProjectScriptResults(
  event: GoogleAppsScript.Addons.EventObject,
  dependencies: ApplyInvoiceProjectScriptResultsDependencies,
): GoogleAppsScript.Card_Service.ActionResponse {
  let request: ApplyInvoiceProjectScriptResultsRequest;
  try {
    request = readApplyInvoiceProjectScriptResultsRequest(event);
  } catch (error) {
    return buildNotificationResponse(getErrorMessage(error), {
      stateChanged: false,
    });
  }

  let appliedWordCount: number;
  try {
    const budget = createActionProcessBudget();
    const list = loadInvoiceProjectScripts(
      request.projectScripts,
      dependencies.reader,
    );
    const result = parseInvoiceProjectScriptCollection(
      request.projectScripts,
      list,
      dependencies.readContent,
      budget,
    );
    if (!result.canApply || result.totalBillableWords === undefined) {
      throw new Error(
        'Parsing is incomplete. Fix unavailable scripts and parse again.',
      );
    }
    if (result.parsingSignature !== request.parsingSignature) {
      throw new Error('Scripts changed. Parse them again before applying.');
    }
    const totalBillableWords = result.totalBillableWords;

    appliedWordCount = dependencies.withLock(() => {
      dependencies.writer.replaceProjectWordCount(
        request.projectScripts.invoiceDocumentId,
        {
          number: request.projectScripts.projectNumber,
          title: request.projectScripts.projectTitle,
        },
        request.projectScripts.collection,
        totalBillableWords,
        list.expectedInvoiceWordCountLine,
      );
      return totalBillableWords;
    });
  } catch (error) {
    logEvent('invoice.project-scripts.apply-failed', 'error', {
      invoiceDocumentId: request.projectScripts.invoiceDocumentId,
      projectFolderId: request.projectScripts.projectFolderId,
      projectNumber: request.projectScripts.projectNumber,
      collection: request.projectScripts.collection,
      ...getErrorLogContext(error),
    });
    return buildNotificationResponse(
      `Could not apply parsing results. ${getErrorMessage(error)}`,
      { stateChanged: false },
    );
  }

  const targetLabel =
    request.projectScripts.collection === 'original'
      ? 'Translation words'
      : 'Voice Over words';
  const message = `${targetLabel} updated to ${appliedWordCount}.`;

  try {
    const workspace = loadInvoiceWorkspace(
      request.projectScripts.invoiceDocumentId,
      dependencies.reader,
    );
    return popAndUpdateCardResponse(
      buildInvoiceHomeCard(toInvoiceHomeView(workspace)),
      { message, stateChanged: true },
    );
  } catch (error) {
    logEvent('invoice.project-scripts.refresh-failed', 'error', {
      invoiceDocumentId: request.projectScripts.invoiceDocumentId,
      projectNumber: request.projectScripts.projectNumber,
      collection: request.projectScripts.collection,
      ...getErrorLogContext(error),
    });
    return buildNotificationResponse(
      `${message} Reload the Invoice card to refresh it.`,
      { stateChanged: true },
    );
  }
}
