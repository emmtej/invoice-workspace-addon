export interface InvoiceDocumentRecord {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export type InvoiceDocumentState =
  | { status: 'missing' }
  | {
      status: 'matched';
      document: InvoiceDocumentRecord;
      duplicates: InvoiceDocumentRecord[];
    }
  | { status: 'unknown'; reason: 'lookup-failed' | 'time-budget-reached' };

function compareInvoicePreference(
  left: InvoiceDocumentRecord,
  right: InvoiceDocumentRecord,
): number {
  const time = (right.modifiedTime ?? '').localeCompare(
    left.modifiedTime ?? '',
  );
  if (time !== 0) {
    return time;
  }
  return left.id.localeCompare(right.id);
}

export function classifyInvoiceDocuments(
  documents: readonly InvoiceDocumentRecord[],
): InvoiceDocumentState {
  if (documents.length === 0) {
    return { status: 'missing' };
  }

  const ranked = [...documents].sort(compareInvoicePreference);
  return {
    status: 'matched',
    document: ranked[0],
    duplicates: ranked.slice(1),
  };
}
