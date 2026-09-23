import {
  toFolderRecord,
  toSourceFileRecord,
  type SourceFileRecord,
  type WorkspaceFolderRecord,
} from '../../shared/drive-records';
import type { DriveApi, DriveFileIdentity } from '../../shared/drive/drive-api';
import {
  GOOGLE_DOCS_MIME_TYPE,
  GOOGLE_FOLDER_MIME_TYPE,
  INVOICE_DOCUMENT_NAME,
} from '../../shared/workspace-domain';
import type { InvoiceDocumentRecord } from './invoice-model';
import type {
  OverviewParentFolder,
  WorkspaceDriveReader,
} from './workspace-reader';

const MISSING_DRIVE_FILE_ID = 'Drive file has no id.';

function withIdentityContext<T>(context: string, operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof Error && error.message === MISSING_DRIVE_FILE_ID) {
      throw new Error(`${context} has no Drive file id.`);
    }
    throw error;
  }
}

function toInvoiceRecord(file: DriveFileIdentity): InvoiceDocumentRecord {
  return {
    id: file.id,
    name: file.name,
    webViewLink: file.webViewLink,
    modifiedTime: file.modifiedTime,
  };
}

export function createWorkspaceDriveReader(
  driveApi: DriveApi,
): WorkspaceDriveReader {
  return {
    getOverviewParent(documentId: string): OverviewParentFolder {
      const overview = driveApi.getFile(documentId, 'parent');
      const parents = overview.parents ?? [];
      if (parents.length !== 1) {
        throw new Error('Overview document must have one parent folder.');
      }
      const parent = withIdentityContext('Overview parent folder', () =>
        driveApi.getFile(parents[0], 'basic'),
      );
      return { id: parent.id, name: parent.name };
    },

    listChildFolders(parentFolderId: string): WorkspaceFolderRecord[] {
      return listFolderRecords(parentFolderId, driveApi);
    },

    listChildFiles(parentFolderId: string): SourceFileRecord[] {
      return listSourceFiles(parentFolderId, driveApi);
    },

    listInvoiceCandidates(parentFolderId: string): InvoiceDocumentRecord[] {
      return listInvoiceCandidates(parentFolderId, driveApi);
    },
  };
}

export function listSourceFiles(
  folderId: string,
  driveApi: DriveApi,
): SourceFileRecord[] {
  return withIdentityContext('Source file', () =>
    driveApi
      .listChildren(folderId, { projection: 'source' })
      .map(toSourceFileRecord),
  );
}

export function listFolderRecords(
  parentFolderId: string,
  driveApi: DriveApi,
): WorkspaceFolderRecord[] {
  return withIdentityContext('Folder', () =>
    driveApi
      .listChildren(parentFolderId, {
        filter: { mimeType: GOOGLE_FOLDER_MIME_TYPE },
        projection: 'folder',
      })
      .map(toFolderRecord),
  );
}

export function listInvoiceCandidates(
  parentFolderId: string,
  driveApi: DriveApi,
): InvoiceDocumentRecord[] {
  return withIdentityContext('Invoice', () =>
    driveApi
      .listChildren(parentFolderId, {
        filter: {
          exactName: INVOICE_DOCUMENT_NAME,
          mimeType: GOOGLE_DOCS_MIME_TYPE,
        },
        projection: 'invoice',
      })
      .map(toInvoiceRecord),
  );
}

export function createInvoiceDocument(
  parentFolderId: string,
  driveApi: DriveApi,
): InvoiceDocumentRecord {
  return withIdentityContext('Invoice', () =>
    toInvoiceRecord(
      driveApi.createGoogleDoc(INVOICE_DOCUMENT_NAME, parentFolderId),
    ),
  );
}

export function createDriveFolder(
  name: string,
  parentFolderId: string,
  driveApi: DriveApi,
): WorkspaceFolderRecord {
  return withIdentityContext('Folder', () =>
    driveApi.createFolder(name, parentFolderId),
  );
}

export function copyDriveFile(
  source: SourceFileRecord,
  destinationFolderId: string,
  appProperties: Record<string, string>,
  driveApi: DriveApi,
): string {
  return withIdentityContext('Copied file', () =>
    driveApi.copyFile(source, destinationFolderId, appProperties),
  );
}
