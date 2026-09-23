import type {
  SourceFileRecord,
  WorkspaceFolderRecord,
} from '../../shared/drive-records';
import {
  getInvoiceWordCountLine,
  matchInvoiceProjectFolders,
  parseInvoiceProjectItems,
  sortInvoiceProjectScripts,
  type InvoiceProjectScriptList,
  type InvoiceScriptCollection,
  type InvoiceWorkspaceItem,
} from './invoice-projects';
import {
  ORIGINAL_SCRIPTS_FOLDER_NAME,
  getProjectFolderName,
} from '../../shared/workspace-domain';
import type { InvoiceFinalization } from './invoice-finalization';
import type { InvoiceRateSettings } from './invoice-settings';

export interface InvoiceParentFolder {
  id: string;
}

export interface InvoiceWorkspaceReader {
  readInvoiceText(documentId: string): string;
  validateInvoiceAndGetParent(documentId: string): InvoiceParentFolder;
  listChildFolders(parentFolderId: string): WorkspaceFolderRecord[];
  listChildFiles(parentFolderId: string): SourceFileRecord[];
}

export interface InvoiceWorkspaceWriter {
  replaceProjectWordCount(
    documentId: string,
    project: { number: number; title: string },
    collection: InvoiceScriptCollection,
    wordCount: number,
    expectedInvoiceWordCountLine: string,
  ): void;
  finalizeInvoice(
    documentId: string,
    settings: InvoiceRateSettings,
  ): InvoiceFinalization;
}

export interface InvoiceWorkspace {
  documentId: string;
  parentFolderId: string;
  items: InvoiceWorkspaceItem[];
}

export interface InvoiceProjectScriptsRequest {
  invoiceDocumentId: string;
  projectFolderId: string;
  projectNumber: number;
  projectTitle: string;
  collection: InvoiceScriptCollection;
}

export function loadInvoiceWorkspace(
  documentId: string,
  reader: InvoiceWorkspaceReader,
): InvoiceWorkspace {
  const parent = reader.validateInvoiceAndGetParent(documentId);
  const text = reader.readInvoiceText(documentId);
  return loadValidatedInvoiceWorkspace(documentId, parent, text, reader);
}

function loadValidatedInvoiceWorkspace(
  documentId: string,
  parent: InvoiceParentFolder,
  text: string,
  reader: InvoiceWorkspaceReader,
): InvoiceWorkspace {
  const items = parseInvoiceProjectItems(text);
  const folders = reader.listChildFolders(parent.id);
  return {
    documentId,
    parentFolderId: parent.id,
    items: matchInvoiceProjectFolders(items, folders),
  };
}

function requireRequestedProject(
  request: InvoiceProjectScriptsRequest,
  workspace: InvoiceWorkspace,
): InvoiceWorkspaceItem & {
  folder: { status: 'matched'; folder: WorkspaceFolderRecord };
} {
  const matches = workspace.items.filter(
    (item) =>
      item.number === request.projectNumber &&
      item.title === request.projectTitle,
  );
  if (matches.length !== 1) {
    throw new Error(
      'Invoice project item is missing or ambiguous. Reload the Invoice card.',
    );
  }

  const item = matches[0];
  if (item.folder.status !== 'matched') {
    throw new Error(
      'Project folder is missing or ambiguous. Reload the Invoice card.',
    );
  }
  if (item.folder.folder.id !== request.projectFolderId) {
    throw new Error('Project folder changed. Reload the Invoice card.');
  }
  return { ...item, folder: item.folder };
}

function listOriginalScripts(
  projectFolderId: string,
  reader: InvoiceWorkspaceReader,
): SourceFileRecord[] {
  const folders = reader
    .listChildFolders(projectFolderId)
    .filter((folder) => folder.name === ORIGINAL_SCRIPTS_FOLDER_NAME);
  if (folders.length === 0) {
    throw new Error('Original Scripts folder is missing.');
  }
  if (folders.length > 1) {
    throw new Error('Multiple Original Scripts folders found.');
  }
  return reader.listChildFiles(folders[0].id);
}

export function loadInvoiceProjectScripts(
  request: InvoiceProjectScriptsRequest,
  reader: InvoiceWorkspaceReader,
): InvoiceProjectScriptList {
  const parent = reader.validateInvoiceAndGetParent(request.invoiceDocumentId);
  const invoiceText = reader.readInvoiceText(request.invoiceDocumentId);
  const workspace = loadValidatedInvoiceWorkspace(
    request.invoiceDocumentId,
    parent,
    invoiceText,
    reader,
  );
  const item = requireRequestedProject(request, workspace);
  const files =
    request.collection === 'original'
      ? listOriginalScripts(item.folder.folder.id, reader)
      : reader.listChildFiles(item.folder.folder.id);
  return {
    collection: request.collection,
    project: {
      number: item.number,
      title: item.title,
    },
    expectedInvoiceWordCountLine: getInvoiceWordCountLine(
      invoiceText,
      item,
      request.collection,
    ),
    files: sortInvoiceProjectScripts(files),
  };
}

export function describeInvoiceWorkspaceItemFolder(
  item: InvoiceWorkspaceItem,
): string | undefined {
  if (item.folder.status === 'matched') {
    return undefined;
  }
  if (item.folder.status === 'missing') {
    return `Folder not found: ${getProjectFolderName(item)}`;
  }
  return `${item.folder.folders.length} matching project folders found.`;
}
