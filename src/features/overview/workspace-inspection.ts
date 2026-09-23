import type { WorkspaceDriveReader } from './workspace-reader';
import { assembleCharacterRequirements } from './character-scripts';
import type { WorkspaceFolderRecord } from '../../shared/drive-records';
import { matchDestinationCharacterRequirements } from './destination-scripts';
import type {
  OverviewProjectItem,
  WorkspaceItemState,
  WorkspaceProjectItem,
} from './model';
import { getErrorLogContext, type LogContext } from '../../shared/logging';
import { logEvent } from '../../diagnostics/logging';
import {
  getProjectFolderName,
  ORIGINAL_SCRIPTS_FOLDER_NAME,
} from '../../shared/workspace-domain';

export type CanContinueInspection = () => boolean;

function logWorkspaceItemClassification(
  documentId: string,
  item: OverviewProjectItem,
  state: WorkspaceItemState,
  logContext: LogContext,
  details: LogContext,
): void {
  const level =
    state.status === 'unknown'
      ? 'error'
      : state.status === 'partial' || state.status === 'ambiguous'
        ? 'warning'
        : 'info';
  if (level === 'info') {
    return;
  }
  logEvent('workspace.item-classified', level, {
    ...logContext,
    documentId,
    projectNumber: item.number,
    status: state.status,
    initialized: state.initialized,
    issueCodes: state.issues.map((issue) => issue.code),
    ...details,
  });
}

function unavailableWorkspaceItemState(
  documentId: string,
  item: OverviewProjectItem,
  folders: WorkspaceFolderRecord[],
  logContext: LogContext,
  reason: string,
): WorkspaceItemState {
  const state: WorkspaceItemState = {
    status: 'unknown',
    folders,
    initialized: false,
    issues: [{ code: 'workspace-inspection-failed' }],
  };
  logWorkspaceItemClassification(documentId, item, state, logContext, {
    reason,
    matchingFolderCount: folders.length,
  });
  return state;
}

export function compareItemToFolders(
  documentId: string,
  item: OverviewProjectItem,
  folders: WorkspaceFolderRecord[],
  drive: Pick<WorkspaceDriveReader, 'listChildFolders' | 'listChildFiles'>,
  logContext: LogContext = {},
  canContinue: CanContinueInspection = () => true,
): WorkspaceItemState {
  const projectFolderName = getProjectFolderName(item);
  const matches = folders.filter((folder) => folder.name === projectFolderName);
  if (matches.length === 0) {
    const state: WorkspaceItemState = {
      status: 'missing',
      folders: [],
      initialized: false,
      issues: [{ code: 'project-folder-missing' }],
    };
    logWorkspaceItemClassification(documentId, item, state, logContext, {
      reason: 'no-exact-name-folder',
    });
    return state;
  }
  if (matches.length > 1) {
    const state: WorkspaceItemState = {
      status: 'ambiguous',
      folders: matches,
      initialized: false,
      issues: [{ code: 'multiple-project-folders', count: matches.length }],
    };
    logWorkspaceItemClassification(documentId, item, state, logContext, {
      reason: 'multiple-exact-name-folders',
      matchingFolderCount: matches.length,
    });
    return state;
  }

  const projectFolder = matches[0];
  if (!canContinue()) {
    return unavailableWorkspaceItemState(
      documentId,
      item,
      matches,
      logContext,
      'inspection-time-budget-reached',
    );
  }
  try {
    const projectChildren = drive.listChildFolders(projectFolder.id);
    const originalScriptsFolders = projectChildren.filter(
      (folder) => folder.name === ORIGINAL_SCRIPTS_FOLDER_NAME,
    );
    if (originalScriptsFolders.length === 0) {
      const state: WorkspaceItemState = {
        status: 'partial',
        folders: matches,
        initialized: false,
        issues: [{ code: 'original-scripts-folder-missing' }],
      };
      logWorkspaceItemClassification(documentId, item, state, logContext, {
        reason: 'original-scripts-folder-missing',
        projectFolderId: projectFolder.id,
      });
      return state;
    }
    if (originalScriptsFolders.length > 1) {
      const state: WorkspaceItemState = {
        status: 'ambiguous',
        folders: matches,
        initialized: false,
        issues: [
          {
            code: 'multiple-original-scripts-folders',
            count: originalScriptsFolders.length,
          },
        ],
      };
      logWorkspaceItemClassification(documentId, item, state, logContext, {
        reason: 'multiple-original-scripts-folders',
        projectFolderId: projectFolder.id,
        originalScriptsFolderCount: originalScriptsFolders.length,
      });
      return state;
    }

    const originalScriptsFolder = originalScriptsFolders[0];
    if (!canContinue()) {
      return unavailableWorkspaceItemState(
        documentId,
        item,
        matches,
        logContext,
        'inspection-time-budget-reached',
      );
    }
    const destinationFiles = drive.listChildFiles(originalScriptsFolder.id);
    const requirements = assembleCharacterRequirements(item.characters);
    const destinationMatches = matchDestinationCharacterRequirements(
      requirements,
      destinationFiles,
    );
    const missingCharacters = destinationMatches.missing
      .filter((entry) => entry.source === 'overview')
      .map((entry) => entry.displayName);
    const ambiguousCharacters = destinationMatches.ambiguous
      .filter((entry) => entry.source === 'overview')
      .map((entry) => entry.displayName);
    const issues: WorkspaceItemState['issues'] = [];
    if (missingCharacters.length) {
      issues.push({
        code: 'required-scripts-missing',
        characters: missingCharacters,
      });
    }
    if (ambiguousCharacters.length) {
      issues.push({
        code: 'required-scripts-ambiguous',
        characters: ambiguousCharacters,
      });
    }
    const complete =
      destinationMatches.overviewCount > 0 && issues.length === 0;
    const state: WorkspaceItemState = {
      status: complete ? 'matched' : 'partial',
      folders: matches,
      initialized: complete,
      issues,
    };
    logWorkspaceItemClassification(documentId, item, state, logContext, {
      reason: complete ? 'live-scripts-complete' : 'live-scripts-incomplete',
      projectFolderId: projectFolder.id,
      originalScriptsFolderId: originalScriptsFolder.id,
      destinationFileCount: destinationFiles.length,
      requiredScriptCount: destinationMatches.overviewCount,
      satisfiedScriptCount: destinationMatches.ready.filter(
        (entry) => entry.source === 'overview',
      ).length,
      missingCharacters,
      ambiguousCharacters,
    });
    return state;
  } catch (error) {
    const state: WorkspaceItemState = {
      status: 'unknown',
      folders: matches,
      initialized: false,
      issues: [{ code: 'workspace-inspection-failed' }],
    };
    logWorkspaceItemClassification(documentId, item, state, logContext, {
      reason: 'nested-workspace-inspection-failed',
      projectFolderId: projectFolder.id,
      ...getErrorLogContext(error),
    });
    return state;
  }
}

export function compareItemsToFolderInventory(
  documentId: string,
  items: OverviewProjectItem[],
  folders: WorkspaceFolderRecord[],
  drive: Pick<WorkspaceDriveReader, 'listChildFolders' | 'listChildFiles'>,
  logContext: LogContext = {},
  canContinue: CanContinueInspection = () => true,
): WorkspaceProjectItem[] {
  return items.map((item) => ({
    ...item,
    workspace: compareItemToFolders(
      documentId,
      item,
      folders,
      drive,
      logContext,
      canContinue,
    ),
  }));
}

export function createUnknownWorkspaceItems(
  items: OverviewProjectItem[],
): WorkspaceProjectItem[] {
  return items.map((item) => ({
    ...item,
    workspace: {
      status: 'unknown',
      folders: [],
      initialized: false,
      issues: [{ code: 'workspace-inspection-failed' }],
    },
  }));
}
