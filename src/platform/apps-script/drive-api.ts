import { toAppsScriptSignedBytes } from '../../shared/drive/blob-io';
import { toFolderRecord, type SourceFileRecord } from '../../shared/drive-records';
import type {
  DriveApi,
  DriveChildFilter,
  DriveFileIdentity,
  DriveFileProjection,
  DriveListChildrenOptions,
} from '../../shared/drive/drive-api';
import {
  GOOGLE_DOCS_MIME_TYPE,
  GOOGLE_FOLDER_MIME_TYPE,
} from '../../shared/workspace-domain';

type DriveFile = GoogleAppsScript.Drive_v3.Drive.V3.Schema.File;
type DriveFileList = GoogleAppsScript.Drive_v3.Drive.V3.Schema.FileList;

export interface AppsScriptDriveFiles {
  get(fileId: string, options: Record<string, unknown>): DriveFile;
  list(options: Record<string, unknown>): DriveFileList;
  create(
    resource: Record<string, unknown>,
    mediaData: GoogleAppsScript.Base.Blob | undefined,
    options: Record<string, unknown>,
  ): DriveFile;
  copy(
    resource: Record<string, unknown>,
    fileId: string,
    options: Record<string, unknown>,
  ): DriveFile;
  update(
    resource: Record<string, unknown>,
    fileId: string,
    mediaData: GoogleAppsScript.Base.Blob | undefined,
    options: Record<string, unknown>,
  ): DriveFile;
}

const PROJECTION_FIELDS: Record<DriveFileProjection, string> = {
  basic: 'id,name',
  folder: 'id,name,webViewLink',
  identity: 'id,name,mimeType,parents,trashed',
  invoice: 'id,name,webViewLink,modifiedTime',
  parent: 'id,name,parents',
  source:
    'id,name,mimeType,webViewLink,appProperties,size,capabilities(canCopy,canDownload)',
};

function driveFiles(): AppsScriptDriveFiles {
  const drive = typeof Drive === 'undefined' ? undefined : Drive;
  if (!drive?.Files) {
    throw new Error('Advanced Drive service is unavailable.');
  }
  return drive.Files as unknown as AppsScriptDriveFiles;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function requireFileId(file: DriveFile): string {
  if (!file.id) {
    throw new Error('Drive file has no id.');
  }
  return file.id;
}

function mapDriveFile(
  file: DriveFile,
  projection: DriveFileProjection,
): DriveFileIdentity {
  return {
    id: requireFileId(file),
    name: file.name ?? '',
    mimeType: file.mimeType ?? projectionMimeType(projection),
    ...mapProjectionFields(file, projection),
  };
}

function projectionMimeType(projection: DriveFileProjection): string {
  if (projection === 'invoice') return GOOGLE_DOCS_MIME_TYPE;
  if (projection === 'folder') return GOOGLE_FOLDER_MIME_TYPE;
  return '';
}

function mapProjectionFields(
  file: DriveFile,
  projection: DriveFileProjection,
): Omit<DriveFileIdentity, 'id' | 'name' | 'mimeType'> {
  switch (projection) {
    case 'basic':
      return {};
    case 'folder':
      return { webViewLink: file.webViewLink };
    case 'identity':
      return {
        parents: file.parents,
        trashed: file.trashed,
      };
    case 'invoice':
      return {
        webViewLink: file.webViewLink,
        modifiedTime: file.modifiedTime,
      };
    case 'parent':
      return { parents: file.parents };
    case 'source':
      return {
        webViewLink: file.webViewLink,
        size: file.size,
        canCopy: file.capabilities?.canCopy !== false,
        canDownload: file.capabilities?.canDownload,
        appProperties: file.appProperties ?? {},
      };
  }
}

function buildChildQuery(
  parentFolderId: string,
  filter: DriveChildFilter | undefined,
): string {
  let query = `'${escapeDriveQueryValue(parentFolderId)}' in parents and trashed = false`;
  if (filter?.mimeType !== undefined) {
    query += ` and mimeType = '${escapeDriveQueryValue(filter.mimeType)}'`;
  }
  if (filter?.exactName !== undefined) {
    query += ` and name = '${escapeDriveQueryValue(filter.exactName)}'`;
  }
  return query;
}

function getDriveFile(
  files: AppsScriptDriveFiles,
  fileId: string,
  projection: DriveFileProjection,
): DriveFileIdentity {
  return mapDriveFile(
    files.get(fileId, {
      supportsAllDrives: true,
      fields: PROJECTION_FIELDS[projection],
    }),
    projection,
  );
}

function listDriveChildren(
  files: AppsScriptDriveFiles,
  parentFolderId: string,
  options: DriveListChildrenOptions = {},
): DriveFileIdentity[] {
  const projection = options.projection ?? 'source';
  const listed: DriveFileIdentity[] = [];
  let pageToken: string | undefined;
  do {
    const page = files.list({
      q: buildChildQuery(parentFolderId, options.filter),
      spaces: 'drive',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: `nextPageToken,files(${PROJECTION_FIELDS[projection]})`,
    });
    listed.push(
      ...(page.files ?? []).map((file) => mapDriveFile(file, projection)),
    );
    pageToken = page.nextPageToken;
  } while (pageToken);
  return listed;
}

function createDriveFile(
  files: AppsScriptDriveFiles,
  name: string,
  parentFolderId: string,
  projection: 'invoice' | 'folder',
): DriveFileIdentity {
  const file = files.create(
    {
      name,
      mimeType: projectionMimeType(projection),
      parents: [parentFolderId],
    },
    undefined,
    {
      supportsAllDrives: true,
      fields: PROJECTION_FIELDS[projection],
    },
  );
  return mapDriveFile(file, projection);
}

function copyDriveFile(
  files: AppsScriptDriveFiles,
  source: SourceFileRecord,
  destinationFolderId: string,
  appProperties: Record<string, string>,
): string {
  const copied = files.copy(
    {
      name: source.name,
      parents: [destinationFolderId],
      appProperties,
    },
    source.id,
    { supportsAllDrives: true, fields: 'id' },
  );
  return requireFileId(copied);
}

function updateDriveFile(
  files: AppsScriptDriveFiles,
  fileId: string,
  resource: Record<string, unknown>,
): void {
  files.update(resource, fileId, undefined, {
    supportsAllDrives: true,
    fields: 'id',
  });
}

function updateDriveBinaryFile(
  files: AppsScriptDriveFiles,
  fileId: string,
  bytes: Uint8Array,
  mimeType: string,
): void {
  const blob = Utilities.newBlob(
    toAppsScriptSignedBytes(bytes),
    mimeType,
  );
  files.update({}, fileId, blob, {
    supportsAllDrives: true,
    fields: 'id',
  });
}

export function createAppsScriptDriveApi(
  files: AppsScriptDriveFiles = driveFiles(),
): DriveApi {
  return {
    getFile: (fileId, projection) => getDriveFile(files, fileId, projection),
    listChildren: (parentFolderId, options) =>
      listDriveChildren(files, parentFolderId, options),
    createGoogleDoc: (name, parentFolderId) =>
      createDriveFile(files, name, parentFolderId, 'invoice'),
    createFolder: (name, parentFolderId) =>
      toFolderRecord(createDriveFile(files, name, parentFolderId, 'folder')),
    copyFile: (source, destinationFolderId, appProperties) =>
      copyDriveFile(files, source, destinationFolderId, appProperties),
    trashFile: (fileId) => updateDriveFile(files, fileId, { trashed: true }),
    clearFileAppProperties(fileId, propertyKeys) {
      const appProperties = Object.fromEntries(
        propertyKeys.map((key) => [key, null]),
      );
      updateDriveFile(files, fileId, { appProperties });
    },
    updateBinaryFile(fileId, bytes, mimeType) {
      updateDriveBinaryFile(files, fileId, bytes, mimeType);
    },
  };
}
