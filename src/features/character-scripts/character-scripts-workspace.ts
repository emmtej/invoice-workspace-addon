import type { DriveApi } from '../../shared/drive/drive-api';
import { splitProjectTitleLines } from '../../shared/character-script-title';
import {
  DOCX_MIME_TYPE,
  DRIVE_ID_PATTERN,
  GOOGLE_DOCS_MIME_TYPE,
  GOOGLE_FOLDER_MIME_TYPE,
  parseNumberedProjectName,
  type NumberedProjectName,
} from '../../shared/workspace-domain';

export const MAX_CHARACTER_SCRIPT_FILES = 100;

export type CharacterScriptsLoadReason =
  | 'invalid-folder-id'
  | 'folder-trashed'
  | 'not-numbered-project'
  | 'invalid-project-title'
  | 'folder-too-large';

export class CharacterScriptsWorkspaceError extends Error {
  readonly reason: CharacterScriptsLoadReason;

  constructor(reason: CharacterScriptsLoadReason) {
    super(reason);
    this.name = 'CharacterScriptsWorkspaceError';
    this.reason = reason;
  }
}

export interface CharacterScriptFile {
  id: string;
  name: string;
  mimeType: typeof GOOGLE_DOCS_MIME_TYPE | typeof DOCX_MIME_TYPE;
  size?: string;
  canDownload?: boolean;
}

export interface CharacterScriptsWorkspace {
  folderId: string;
  project: NumberedProjectName;
  files: readonly CharacterScriptFile[];
}

export function isCharacterScriptMimeType(
  mimeType: string,
): mimeType is CharacterScriptFile['mimeType'] {
  return mimeType === GOOGLE_DOCS_MIME_TYPE || mimeType === DOCX_MIME_TYPE;
}

export function loadCharacterScriptsWorkspace(
  folderId: string,
  drive: Pick<DriveApi, 'getFile' | 'listChildren'>,
): CharacterScriptsWorkspace {
  if (!DRIVE_ID_PATTERN.test(folderId)) {
    throw new CharacterScriptsWorkspaceError('invalid-folder-id');
  }
  const folder = drive.getFile(folderId, 'identity');
  const project = parseNumberedProjectName(folder.name);
  if (folder.trashed === true) {
    throw new CharacterScriptsWorkspaceError('folder-trashed');
  }
  if (folder.mimeType !== GOOGLE_FOLDER_MIME_TYPE || !project) {
    throw new CharacterScriptsWorkspaceError('not-numbered-project');
  }
  if (splitProjectTitleLines(project.title).length === 0) {
    throw new CharacterScriptsWorkspaceError('invalid-project-title');
  }
  const files = drive
    .listChildren(folderId, { projection: 'source' })
    .filter((child) => isCharacterScriptMimeType(child.mimeType))
    .map((child) => ({
      id: child.id,
      name: child.name,
      mimeType: child.mimeType as CharacterScriptFile['mimeType'],
      size: child.size,
      canDownload: child.canDownload,
    }))
    .sort((left, right) => {
      const byName = left.name.localeCompare(right.name);
      return byName === 0 ? left.id.localeCompare(right.id) : byName;
    });
  if (files.length > MAX_CHARACTER_SCRIPT_FILES) {
    throw new CharacterScriptsWorkspaceError('folder-too-large');
  }
  return { folderId, project, files };
}
