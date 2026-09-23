import { readDriveIdParameter } from '../../shared/addon-event';
import {
  INVOICE_DOCUMENT_ID_PARAMETER,
  PARSING_SIGNATURE_PARAMETER,
  PROJECT_FOLDER_ID_PARAMETER,
  PROJECT_NUMBER_PARAMETER,
  PROJECT_TITLE_PARAMETER,
  SCRIPT_COLLECTION_PARAMETER,
} from './invoice-action-ids';
import { type InvoiceScriptCollection } from './invoice-projects';
import { type InvoiceProjectScriptsRequest } from './invoice-workspace';
import { isInvoiceParsingSignature } from './invoice-parsing-signature';

export function readParsingSignature(
  event: GoogleAppsScript.Addons.EventObject,
): string {
  const parsingSignature =
    event.commonEventObject?.parameters?.[PARSING_SIGNATURE_PARAMETER];
  if (!parsingSignature || !isInvoiceParsingSignature(parsingSignature)) {
    throw new Error('Missing or invalid parsing result signature.');
  }
  return parsingSignature;
}

export function readPageParameter(
  parameters: Record<string, string>,
  parameterName: string,
  errorMessage: string,
): number {
  const pageText = parameters[parameterName];
  const page = Number(pageText);
  if (
    pageText === undefined ||
    !/^\d+$/.test(pageText) ||
    !Number.isSafeInteger(page)
  ) {
    throw new Error(errorMessage);
  }
  return page;
}

export function readInvoiceProjectScriptsRequest(
  event: GoogleAppsScript.Addons.EventObject,
): InvoiceProjectScriptsRequest {
  const parameters = event.commonEventObject?.parameters ?? {};
  const invoiceDocumentId = readDriveIdParameter(
    parameters,
    INVOICE_DOCUMENT_ID_PARAMETER,
    'Missing or invalid Invoice document id.',
  );
  const projectFolderId = readDriveIdParameter(
    parameters,
    PROJECT_FOLDER_ID_PARAMETER,
    'Missing or invalid project folder id.',
  );
  const projectNumberText = parameters[PROJECT_NUMBER_PARAMETER];
  const projectTitle = parameters[PROJECT_TITLE_PARAMETER];
  const collection = parameters[SCRIPT_COLLECTION_PARAMETER] as
    | InvoiceScriptCollection
    | undefined;
  const projectNumber = Number(projectNumberText);
  if (
    !projectNumberText ||
    !/^\d+$/.test(projectNumberText) ||
    !Number.isSafeInteger(projectNumber)
  ) {
    throw new Error('Missing or invalid project number.');
  }
  if (!projectTitle?.trim()) {
    throw new Error('Missing project title.');
  }
  if (collection !== 'original' && collection !== 'translated') {
    throw new Error('Missing or invalid script collection.');
  }

  return {
    invoiceDocumentId,
    projectFolderId,
    projectNumber,
    projectTitle,
    collection,
  };
}
