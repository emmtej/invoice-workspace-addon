import type { LogLevel } from '../../shared/logging';
import { GOOGLE_DOCS_MIME_TYPE } from '../../shared/workspace-domain';
import type {
  CharacterScriptFile,
  CharacterScriptsWorkspace,
} from './character-scripts-workspace';
import type { DocxTitleWriteResult } from './docx-title-writer';
import type { GoogleDocTitleWriteResult } from './google-doc-title-writer';

export type CharacterScriptFileStatus =
  | { kind: 'updated' }
  | { kind: 'skipped'; reason: 'already-titled' | 'time-limit' }
  | { kind: 'failed'; reason: string };

type TitleWriteResult = GoogleDocTitleWriteResult | DocxTitleWriteResult;

function isTimeLimit(result: TitleWriteResult): boolean {
  return result.status === 'skipped' && 'reason' in result && result.reason === 'time-limit';
}

export function writeCharacterScriptTitleHeaders(
  workspace: CharacterScriptsWorkspace,
  ports: {
    writeGoogleDoc: (
      file: CharacterScriptFile,
      project: CharacterScriptsWorkspace['project'],
    ) => GoogleDocTitleWriteResult;
    writeDocx: (
      file: CharacterScriptFile,
      project: CharacterScriptsWorkspace['project'],
    ) => DocxTitleWriteResult;
    canContinue: () => boolean;
  },
  log: (event: string, level: LogLevel, context: Record<string, unknown>) => void,
): CharacterScriptFileStatus[] {
  const results: CharacterScriptFileStatus[] = [];
  for (let index = 0; index < workspace.files.length; index += 1) {
    if (!ports.canContinue()) {
      log('character-scripts.write.time-budget-reached', 'warning', {
        remainingCount: workspace.files.length - index,
        reason: 'time-budget',
      });
      while (results.length < workspace.files.length) {
        results.push({ kind: 'skipped', reason: 'time-limit' });
      }
      break;
    }
    const file = workspace.files[index];
    let written: TitleWriteResult;
    try {
      written =
        file.mimeType === GOOGLE_DOCS_MIME_TYPE
          ? ports.writeGoogleDoc(file, workspace.project)
          : ports.writeDocx(file, workspace.project);
    } catch {
      log('character-scripts.write.file-failed', 'error', {
        reason: 'write-failed',
      });
      results.push({ kind: 'failed', reason: 'write-failed' });
      continue;
    }
    if (isTimeLimit(written)) {
      log('character-scripts.write.time-budget-reached', 'warning', {
        remainingCount: workspace.files.length - index,
        reason: 'time-budget',
      });
      results.push({ kind: 'skipped', reason: 'time-limit' });
      while (results.length < workspace.files.length) {
        results.push({ kind: 'skipped', reason: 'time-limit' });
      }
      break;
    }
    if (written.status === 'skipped') {
      results.push({ kind: 'skipped', reason: 'already-titled' });
    } else if (written.status === 'updated') {
      results.push({ kind: 'updated' });
    } else {
      log('character-scripts.write.file-failed', 'error', {
        reason: written.reason,
      });
      results.push({ kind: 'failed', reason: written.reason });
    }
  }
  return results;
}
