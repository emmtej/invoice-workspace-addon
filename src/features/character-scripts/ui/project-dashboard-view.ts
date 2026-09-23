import {
  GOOGLE_DOCS_MIME_TYPE,
  getProjectFolderName,
} from '../../../shared/workspace-domain';
import type { CardActionSpec, FooterView } from '../../../ui/models';
import {
  FOLDER_ID_PARAMETER,
  WRITE_CHARACTER_SCRIPT_TITLE_HEADERS_ACTION,
} from '../character-scripts-action-ids';
import type { CharacterScriptFileStatus } from '../write-title-headers';
import type { CharacterScriptsWorkspace } from '../character-scripts-workspace';

export interface CharacterScriptRowView {
  topLabel: string;
  text: string;
  bottomLabel?: string;
}

export interface ProjectDashboardView {
  title: string;
  subtitle: string;
  empty?: { title: string; hint: string };
  rows: readonly CharacterScriptRowView[];
  footer?: FooterView;
}

function mimeLabel(mimeType: CharacterScriptsWorkspace['files'][number]['mimeType']): string {
  return mimeType === GOOGLE_DOCS_MIME_TYPE ? 'Google Doc' : 'DOCX';
}

function statusLabel(status: CharacterScriptFileStatus): string {
  if (status.kind === 'updated') {
    return 'Updated';
  }
  if (status.kind === 'skipped' && status.reason === 'already-titled') {
    return 'Already titled';
  }
  if (status.kind === 'skipped' && status.reason === 'time-limit') {
    return 'Skipped (time limit)';
  }
  return `Failed: ${status.reason}`;
}

export function toProjectDashboardView(
  workspace: CharacterScriptsWorkspace,
  statuses?: readonly CharacterScriptFileStatus[],
): ProjectDashboardView {
  const view: ProjectDashboardView = {
    title: 'Character scripts',
    subtitle: getProjectFolderName(workspace.project),
    rows: workspace.files.map((file, index) => {
      const row: CharacterScriptRowView = {
        topLabel: file.name,
        text: mimeLabel(file.mimeType),
      };
      if (statuses?.[index]) {
        row.bottomLabel = statusLabel(statuses[index]);
      }
      return row;
    }),
  };
  if (workspace.files.length === 0) {
    view.empty = {
      title: 'No translated character scripts in this folder.',
      hint:
        'Put Google Docs or DOCX files in the project folder root. Original Scripts is ignored.',
    };
    return view;
  }
  const action: CardActionSpec = {
    functionName: WRITE_CHARACTER_SCRIPT_TITLE_HEADERS_ACTION,
    parameters: { [FOLDER_ID_PARAMETER]: workspace.folderId },
    spinner: true,
  };
  view.footer = {
    primary: {
      label: 'Write title headers',
      altText: 'Write title headers on translated character scripts',
      style: 'filled',
      action,
    },
  };
  return view;
}
