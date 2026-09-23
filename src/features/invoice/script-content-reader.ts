import { DOCX_LIMITS, type DocxUnzippedEntry } from '../../shared/docx/package';
import {
  createAppsScriptDriveBlobReader,
  downloadDocxMedia,
} from './docx-download';
import type { DriveDownloadResult } from '../../shared/drive/blob-io';
import { preflightDocxArchive } from '../../shared/docx/zip-preflight';
import { readDocxPackage, unzipDocxWithUtilities } from './docx-reader';
import { readGoogleDocText } from './google-doc-reader';
import {
  unavailableResult,
  type ScriptContentReadResult,
} from './script-content';
import type { SourceFileRecord } from '../../shared/drive-records';
import {
  DOCX_MIME_TYPE,
  GOOGLE_DOCS_MIME_TYPE,
} from '../../shared/workspace-domain';

export interface ScriptContentReaderDependencies {
  readGoogleDoc?(fileId: string): ScriptContentReadResult;
  downloadDocx?(fileId: string): DriveDownloadResult;
  unzipDocx?(bytes: Uint8Array): DocxUnzippedEntry[];
}

const LISTED_SIZE_PATTERN = /^\d+$/;

function listedCompressedSize(file: SourceFileRecord): number | undefined {
  if (file.size === undefined || file.size === '') {
    return undefined;
  }
  if (!LISTED_SIZE_PATTERN.test(file.size)) {
    return undefined;
  }
  return Number(file.size);
}

export function createAppsScriptScriptContentReader(): ScriptContentReaderDependencies {
  const reader = createAppsScriptDriveBlobReader();
  return {
    readGoogleDoc(fileId) {
      return readGoogleDocText(fileId, DocumentApp);
    },
    downloadDocx(fileId) {
      return downloadDocxMedia(fileId, reader);
    },
    unzipDocx: unzipDocxWithUtilities,
  };
}

export function readScriptContent(
  file: SourceFileRecord,
  deps: ScriptContentReaderDependencies = {},
): ScriptContentReadResult {
  if (file.mimeType === GOOGLE_DOCS_MIME_TYPE) {
    if (!deps.readGoogleDoc) {
      return unavailableResult('read-failed');
    }
    return deps.readGoogleDoc(file.id);
  }

  if (file.mimeType !== DOCX_MIME_TYPE) {
    return unavailableResult('unsupported-mime-type');
  }

  if (file.canDownload !== true) {
    return unavailableResult('download-disabled');
  }

  const listedSize = listedCompressedSize(file);
  if (listedSize === undefined) {
    return unavailableResult('invalid-file-metadata');
  }
  if (listedSize > DOCX_LIMITS.maxCompressedBytes) {
    return unavailableResult('file-too-large');
  }

  if (!deps.downloadDocx || !deps.unzipDocx) {
    return unavailableResult('download-failed');
  }

  const downloaded = deps.downloadDocx(file.id);
  if (downloaded.status !== 'ready') {
    return downloaded;
  }

  if (downloaded.bytes.length > DOCX_LIMITS.maxCompressedBytes) {
    return unavailableResult('file-too-large');
  }

  const preflight = preflightDocxArchive(downloaded.bytes);
  if (preflight.status !== 'ready') {
    return unavailableResult(preflight.reason, preflight.detail);
  }

  let entries: DocxUnzippedEntry[];
  try {
    entries = deps.unzipDocx(downloaded.bytes);
  } catch {
    return readDocxPackage({ unzipError: true });
  }

  return readDocxPackage({ entries });
}
