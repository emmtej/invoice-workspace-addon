import type {
  InitializationRunContext,
  ProjectInitializationDependencies,
} from './initialize-model';
import type { OverviewProjectItem } from './model';
import type { WorkspaceFolderRecord } from '../../shared/drive-records';
import {
  getProjectFolderName,
  ORIGINAL_SCRIPTS_FOLDER_NAME,
} from '../../shared/workspace-domain';

interface DestinationResult {
  projectFolder?: WorkspaceFolderRecord;
  originalScriptsFolder?: WorkspaceFolderRecord;
  conflict?: string;
}

export function resolveDestination(
  context: InitializationRunContext,
  item: OverviewProjectItem,
  dependencies: Pick<
    ProjectInitializationDependencies,
    'listFolderRecords' | 'createDriveFolder' | 'withLock'
  >,
): DestinationResult {
  return dependencies.withLock(() => {
    const projectFolderName = getProjectFolderName(item);
    const exactFolders = dependencies
      .listFolderRecords(context.parentFolderId)
      .filter((folder) => folder.name === projectFolderName);
    if (exactFolders.length > 1) {
      return {
        conflict:
          'Multiple matching project folders exist. Nothing was changed.',
      };
    }

    let projectFolder = exactFolders[0];
    if (!projectFolder) {
      if (!context.budget.canContinue()) {
        return {
          conflict: `Project ${item.number} was not started before the time limit.`,
        };
      }
      projectFolder = dependencies.createDriveFolder(
        projectFolderName,
        context.parentFolderId,
      );
      context.mutation.changed = true;
    }

    const originalScriptsMatches = dependencies
      .listFolderRecords(projectFolder.id)
      .filter((folder) => folder.name === ORIGINAL_SCRIPTS_FOLDER_NAME);
    if (originalScriptsMatches.length > 1) {
      return {
        projectFolder,
        conflict:
          'Multiple Original Scripts folders exist. Nothing more was changed.',
      };
    }
    let originalScriptsFolder = originalScriptsMatches[0];
    if (!originalScriptsFolder) {
      if (!context.budget.canContinue()) {
        return {
          projectFolder,
          conflict: 'Time limit reached. Resume initialization.',
        };
      }
      originalScriptsFolder = dependencies.createDriveFolder(
        ORIGINAL_SCRIPTS_FOLDER_NAME,
        projectFolder.id,
      );
      context.mutation.changed = true;
    }
    return { projectFolder, originalScriptsFolder };
  });
}
