import { logEvent } from '../../diagnostics/logging';
import { readDriveIdParameter } from '../../shared/addon-event';
import { buildErrorCard } from '../../ui/chrome';
import {
  buildNotificationResponse,
  updateCardResponse,
} from '../../ui/navigation';
import { FOLDER_ID_PARAMETER } from './character-scripts-action-ids';
import {
  CharacterScriptsWorkspaceError,
  loadCharacterScriptsWorkspace,
  type CharacterScriptFile,
  type CharacterScriptsWorkspace,
} from './character-scripts-workspace';
import {
  unzipDocxParts,
  writeDocxTitleHeader,
  zipDocxParts,
} from './docx-title-writer';
import { toCharacterScriptsErrorView } from './ui/character-scripts-error-view';
import { buildProjectDashboardCard } from './ui/project-dashboard-card';
import { toProjectDashboardView } from './ui/project-dashboard-view';
import { writeCharacterScriptTitleHeaders } from './write-title-headers';
import type { ActionProcessBudget } from '../../shared/action-process-budget';
import type { DriveApi } from '../../shared/drive/drive-api';
import type { DriveBlobReader } from '../../shared/drive/blob-io';
import type { GoogleDocTitleWriteResult } from './google-doc-title-writer';

export interface CharacterScriptsActionDependencies {
  drive: Pick<DriveApi, 'getFile' | 'listChildren' | 'updateBinaryFile'>;
  blobReader: DriveBlobReader;
  budget: ActionProcessBudget;
  writeGoogleDoc: (
    file: CharacterScriptFile,
    project: CharacterScriptsWorkspace['project'],
  ) => GoogleDocTitleWriteResult;
}

function failedLoadResponse(reason: 'missing-folder-id' | 'load-failed') {
  return updateCardResponse(
    buildErrorCard(toCharacterScriptsErrorView(reason)),
  );
}

export function handleWriteCharacterScriptTitleHeaders(
  event: GoogleAppsScript.Addons.EventObject,
  dependencies: CharacterScriptsActionDependencies,
): GoogleAppsScript.Card_Service.ActionResponse {
  let folderId: string;
  try {
    folderId = readDriveIdParameter(
      event.commonEventObject?.parameters,
      FOLDER_ID_PARAMETER,
      'Missing or invalid project folder id.',
    );
  } catch {
    logEvent('character-scripts.write.failed', 'error', {
      handler: 'onWriteCharacterScriptTitleHeaders',
      reason: 'missing-folder-id',
    });
    return failedLoadResponse('missing-folder-id');
  }

  let workspace: CharacterScriptsWorkspace;
  try {
    workspace = loadCharacterScriptsWorkspace(folderId, dependencies.drive);
  } catch (error) {
    const reason =
      error instanceof CharacterScriptsWorkspaceError
        ? error.reason
        : 'load-failed';
    logEvent('character-scripts.write.failed', 'error', {
      handler: 'onWriteCharacterScriptTitleHeaders',
      reason,
    });
    return updateCardResponse(
      buildErrorCard(toCharacterScriptsErrorView(reason)),
    );
  }

  const statuses = writeCharacterScriptTitleHeaders(
    workspace,
    {
      canContinue: () => dependencies.budget.canContinue(),
      writeGoogleDoc: (file, project) =>
        dependencies.writeGoogleDoc(file, project),
      writeDocx: (file, project) =>
        writeDocxTitleHeader(file, project, {
          blobReader: dependencies.blobReader,
          unzip: unzipDocxParts,
          zip: zipDocxParts,
          updateBinaryFile: dependencies.drive.updateBinaryFile,
          canContinue: () => dependencies.budget.canContinue(),
        }),
    },
    logEvent,
  );

  try {
    return updateCardResponse(
      buildProjectDashboardCard(toProjectDashboardView(workspace, statuses)),
    );
  } catch {
    logEvent('character-scripts.write.render-failed', 'error', {
      handler: 'onWriteCharacterScriptTitleHeaders',
      reason: 'render-failed',
    });
    return buildNotificationResponse(
      'Title headers may already have been written. Reload the Character scripts card to see current files.',
    );
  }
}
