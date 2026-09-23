import type { DriveFileIdentity } from './drive/drive-api';

export interface SourceFileRecord {
  id: string;
  name: string;
  mimeType: string;
  canCopy: boolean;
  canDownload?: boolean;
  size?: string;
  appProperties?: Record<string, string>;
}

export interface WorkspaceFolderRecord {
  id: string;
  name: string;
  webViewLink?: string;
}

export function toFolderRecord(file: DriveFileIdentity): WorkspaceFolderRecord {
  return {
    id: file.id,
    name: file.name,
    webViewLink: file.webViewLink,
  };
}

export function toSourceFileRecord(file: DriveFileIdentity): SourceFileRecord {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    canCopy: file.canCopy !== false,
    canDownload: file.canDownload,
    size: file.size,
    appProperties: file.appProperties ?? {},
  };
}
