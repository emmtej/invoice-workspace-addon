import { DRIVE_ID_PATTERN } from '../workspace-domain';

export interface DriveBlobReader {
  getBytes(fileId: string): ArrayLike<number>;
}

export type DriveDownloadResult =
  | { status: 'ready'; bytes: Uint8Array }
  | {
      status: 'unavailable';
      reason: 'access-denied' | 'download-failed';
    };

export interface DriveBlobFailureContext {
  cause: 'invalid-file-id' | 'empty-bytes' | 'blob-threw';
  resultReason: 'access-denied' | 'download-failed';
  errorName?: string;
  errorMessage?: string;
}

export function toUint8Array(content: ArrayLike<number>): Uint8Array {
  return Uint8Array.from(content, (byte) => byte & 0xff);
}

export function toAppsScriptSignedBytes(bytes: Uint8Array): number[] {
  return Array.from(bytes, (byte) => (byte > 0x7f ? byte - 0x100 : byte));
}

export function redactDriveLogText(text: string): string {
  return text
    .replace(/Bearer\s+\S+/gi, 'Bearer <redacted>')
    .replace(/(\/files\/)[A-Za-z0-9_-]+/g, '$1<id>')
    .replace(/([?&](?:access_token|token)=)[^&\s]+/gi, '$1<redacted>')
    .replace(/\b[A-Za-z0-9_]*-[A-Za-z0-9_-]+\b/g, '<id>')
    .replace(/\b[A-Za-z0-9_-]{20,}\b/g, '<id>')
    .replace(/\b[A-Z]{4,}\b/g, '<redacted>');
}

function classifyDriveAppError(
  message: string,
): 'access-denied' | 'download-failed' {
  return /permission|denied|unauthorized|forbidden/i.test(message)
    ? 'access-denied'
    : 'download-failed';
}

export function readDriveBlob(
  fileId: string,
  reader: DriveBlobReader,
  onFailure?: (context: DriveBlobFailureContext) => void,
): DriveDownloadResult {
  if (!DRIVE_ID_PATTERN.test(fileId)) {
    onFailure?.({
      cause: 'invalid-file-id',
      resultReason: 'download-failed',
    });
    return { status: 'unavailable', reason: 'download-failed' };
  }
  try {
    const bytes = toUint8Array(reader.getBytes(fileId));
    if (bytes.length === 0) {
      onFailure?.({
        cause: 'empty-bytes',
        resultReason: 'download-failed',
      });
      return { status: 'unavailable', reason: 'download-failed' };
    }
    return { status: 'ready', bytes };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const resultReason = classifyDriveAppError(errorMessage);
    onFailure?.({
      cause: 'blob-threw',
      resultReason,
      errorName: error instanceof Error ? error.name : 'unknown',
      errorMessage: redactDriveLogText(errorMessage).slice(0, 300),
    });
    return { status: 'unavailable', reason: resultReason };
  }
}

export function driveBlobErrorMessage(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return redactDriveLogText(errorMessage).slice(0, 300);
}
