import { logEvent } from '../../diagnostics/logging';
import {
  readDriveBlob,
  type DriveBlobReader,
  type DriveDownloadResult,
} from '../../shared/drive/blob-io';

export function downloadDocxMedia(
  fileId: string,
  reader: DriveBlobReader,
): DriveDownloadResult {
  return readDriveBlob(fileId, reader, (context) => {
    logEvent('invoice.docx-download.failed', 'error', { ...context });
  });
}

export function createAppsScriptDriveBlobReader(): DriveBlobReader {
  return {
    getBytes(fileId) {
      return DriveApp.getFileById(fileId).getBlob().getBytes();
    },
  };
}
