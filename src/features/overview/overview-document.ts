import type { OverviewProjectItem } from './model';
import { parseOverviewText } from './parser';
import { getErrorLogContext, type LogContext } from '../../shared/logging';
import { logEvent } from '../../diagnostics/logging';

export function isOverviewDocumentName(name: string): boolean {
  return /\boverview\b/i.test(name);
}

export function loadOverviewProjectItems(
  documentId: string,
  logContext: LogContext = {},
): OverviewProjectItem[] {
  try {
    const text = DocumentApp.openById(documentId).getBody().getText();
    return parseOverviewText(text);
  } catch (error) {
    logEvent('overview.document-read.failed', 'error', {
      ...logContext,
      documentId,
      ...getErrorLogContext(error),
    });
    throw error;
  }
}
