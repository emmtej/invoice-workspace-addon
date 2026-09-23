import {
  unavailableResult,
  type ScriptContentReadResult,
} from './script-content';
import { collectGoogleDocTabs } from '../../shared/google-doc-tabs';

export interface GoogleDocTab {
  getChildTabs(): GoogleDocTab[];
  asDocumentTab(): { getBody(): { getText(): string } };
}

export interface GoogleDocOpener {
  openById(id: string): { getTabs(): GoogleDocTab[] };
}

export function readGoogleDocText(
  fileId: string,
  opener: GoogleDocOpener,
): ScriptContentReadResult {
  try {
    const tabs = collectGoogleDocTabs(
      opener.openById(fileId).getTabs(),
      (tab) => tab.getChildTabs(),
    );
    if (tabs.length === 0) {
      return unavailableResult('unsupported-document-structure', 'missing-tab');
    }
    if (tabs.length !== 1) {
      return unavailableResult(
        'unsupported-document-structure',
        'multiple-tabs',
      );
    }
    const text = tabs[0].asDocumentTab().getBody().getText();
    return { status: 'ready', text };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/permission|denied|access|unauthorized|not found/i.test(message)) {
      return unavailableResult('access-denied');
    }
    return unavailableResult('read-failed');
  }
}
