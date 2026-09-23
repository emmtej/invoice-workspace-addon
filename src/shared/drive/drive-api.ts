import type { SourceFileRecord, WorkspaceFolderRecord } from '../drive-records';

export type DriveFileProjection =
  | 'basic'
  | 'folder'
  | 'identity'
  | 'invoice'
  | 'parent'
  | 'source';

export interface DriveFileIdentity {
  id: string;
  name: string;
  mimeType: string;
  parents?: readonly string[];
  trashed?: boolean;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
  canCopy?: boolean;
  canDownload?: boolean;
  appProperties?: Record<string, string>;
}

export interface DriveChildFilter {
  exactName?: string;
  mimeType?: string;
}

export interface DriveListChildrenOptions {
  filter?: DriveChildFilter;
  projection?: DriveFileProjection;
}

export interface DriveApi {
  getFile(fileId: string, projection: DriveFileProjection): DriveFileIdentity;

  listChildren(
    parentFolderId: string,
    options?: DriveListChildrenOptions,
  ): DriveFileIdentity[];

  createGoogleDoc(name: string, parentFolderId: string): DriveFileIdentity;

  createFolder(name: string, parentFolderId: string): WorkspaceFolderRecord;

  copyFile(
    source: SourceFileRecord,
    destinationFolderId: string,
    appProperties: Record<string, string>,
  ): string;

  trashFile(fileId: string): void;

  clearFileAppProperties(fileId: string, propertyKeys: readonly string[]): void;

  updateBinaryFile(fileId: string, bytes: Uint8Array, mimeType: string): void;
}
