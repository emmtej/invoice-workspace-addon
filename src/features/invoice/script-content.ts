export type ScriptContentUnavailableReason =
  | 'unsupported-mime-type'
  | 'download-disabled'
  | 'file-too-large'
  | 'invalid-file-metadata'
  | 'access-denied'
  | 'download-failed'
  | 'invalid-docx'
  | 'unsupported-docx-structure'
  | 'unsupported-document-structure'
  | 'read-failed';

export type ScriptContentReadResult =
  | { status: 'ready'; text: string }
  | {
      status: 'unavailable';
      reason: ScriptContentUnavailableReason;
      detail?: string;
    };

export function unavailableResult(
  reason: ScriptContentUnavailableReason,
  detail?: string,
): ScriptContentReadResult {
  return detail === undefined
    ? { status: 'unavailable', reason }
    : { status: 'unavailable', reason, detail };
}
