import type { OverviewProjectItem } from './model';
import type {
  SourceFileRecord,
  WorkspaceFolderRecord,
} from '../../shared/drive-records';
import {
  GOOGLE_FOLDER_MIME_TYPE,
  getProjectFolderName,
  ORIGINAL_SCRIPTS_FOLDER_NAME,
} from '../../shared/workspace-domain';
import { SCRIPT_COPY_APP_PROPERTIES } from './destination-scripts';

export const PROJECT_SCRIPT_APP_PROPERTY_KEYS = Object.freeze([
  'iwRole',
  SCRIPT_COPY_APP_PROPERTIES.version,
  'iwOverviewId',
  'iwProjectNumber',
  'iwSourceFolderId',
  'iwCharacterSignature',
  'iwState',
  'iwProgress',
  'iwUnresolved',
  SCRIPT_COPY_APP_PROPERTIES.characterKey,
  SCRIPT_COPY_APP_PROPERTIES.sourceFileId,
]);

export interface ClearProjectScriptPropertiesResult {
  clearedFileCount: number;
  clearedPropertyCount: number;
  skippedProjectCount: number;
  failedProjectCount: number;
  failedFileCount: number;
  timedOut: boolean;
}

export interface ProjectScriptPropertiesDependencies {
  loadItems(documentId: string): OverviewProjectItem[];
  getOverviewParent(documentId: string): { id: string; name: string };
  listFolderRecords(parentFolderId: string): WorkspaceFolderRecord[];
  listSourceFiles(folderId: string): SourceFileRecord[];
  clearFileAppProperties(fileId: string, propertyKeys: readonly string[]): void;
  canContinue(): boolean;
  withLock<T>(operation: () => T): T;
}

function countKnownProperties(file: SourceFileRecord): number {
  if (file.mimeType === GOOGLE_FOLDER_MIME_TYPE) {
    return 0;
  }
  const properties = file.appProperties ?? {};
  return PROJECT_SCRIPT_APP_PROPERTY_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(properties, key),
  ).length;
}

export function clearProjectScriptAppProperties(
  documentId: string,
  dependencies: ProjectScriptPropertiesDependencies,
): ClearProjectScriptPropertiesResult {
  const result: ClearProjectScriptPropertiesResult = {
    clearedFileCount: 0,
    clearedPropertyCount: 0,
    skippedProjectCount: 0,
    failedProjectCount: 0,
    failedFileCount: 0,
    timedOut: false,
  };
  const items = dependencies.loadItems(documentId);
  const parent = dependencies.getOverviewParent(documentId);
  const projectFolders = dependencies.listFolderRecords(parent.id);

  for (const item of items) {
    if (!dependencies.canContinue()) {
      result.timedOut = true;
      break;
    }

    try {
      const matchingProjectFolders = projectFolders.filter(
        (folder) => folder.name === getProjectFolderName(item),
      );
      if (matchingProjectFolders.length !== 1) {
        result.skippedProjectCount++;
        continue;
      }

      const originalScriptsFolders = dependencies
        .listFolderRecords(matchingProjectFolders[0].id)
        .filter((folder) => folder.name === ORIGINAL_SCRIPTS_FOLDER_NAME);
      if (originalScriptsFolders.length !== 1) {
        result.skippedProjectCount++;
        continue;
      }

      const files = dependencies.listSourceFiles(originalScriptsFolders[0].id);
      for (const file of files) {
        const propertyCount = countKnownProperties(file);
        if (propertyCount === 0) {
          continue;
        }
        if (!dependencies.canContinue()) {
          result.timedOut = true;
          break;
        }
        try {
          dependencies.withLock(() => {
            dependencies.clearFileAppProperties(
              file.id,
              PROJECT_SCRIPT_APP_PROPERTY_KEYS,
            );
          });
          result.clearedFileCount++;
          result.clearedPropertyCount += propertyCount;
        } catch (_error) {
          result.failedFileCount++;
        }
      }
    } catch (_error) {
      result.failedProjectCount++;
    }
    if (result.timedOut) {
      break;
    }
  }

  return result;
}

export function formatClearProjectScriptPropertiesResult(
  result: ClearProjectScriptPropertiesResult,
): string {
  const parts: string[] = [];
  if (result.clearedFileCount === 0) {
    parts.push(
      result.failedProjectCount > 0 ||
        result.skippedProjectCount > 0 ||
        result.failedFileCount > 0 ||
        result.timedOut
        ? 'No Invoice Workspace app properties were cleared.'
        : 'No Invoice Workspace app properties found.',
    );
  } else {
    parts.push(
      `Cleared ${result.clearedPropertyCount} app ${
        result.clearedPropertyCount === 1 ? 'property' : 'properties'
      } from ${result.clearedFileCount} project ${
        result.clearedFileCount === 1 ? 'script' : 'scripts'
      }.`,
    );
  }
  if (result.skippedProjectCount > 0) {
    parts.push(
      `Skipped ${result.skippedProjectCount} project${
        result.skippedProjectCount === 1 ? '' : 's'
      } with missing or ambiguous folders.`,
    );
  }
  if (result.failedProjectCount > 0) {
    parts.push(
      `${result.failedProjectCount} project${
        result.failedProjectCount === 1 ? '' : 's'
      } could not be inspected.`,
    );
  }
  if (result.failedFileCount > 0) {
    parts.push(
      `${result.failedFileCount} script${
        result.failedFileCount === 1 ? '' : 's'
      } could not be updated.`,
    );
  }
  if (result.timedOut) {
    parts.push('Time limit reached. Run the action again to continue.');
  }
  return parts.join(' ');
}
