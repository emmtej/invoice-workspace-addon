import { createActionProcessBudget } from '../../shared/action-process-budget';
import type { DriveBlobReader } from '../../shared/drive/blob-io';
import type { CharacterScriptsActionDependencies } from '../../features/character-scripts/character-scripts-actions';
import { writeGoogleDocTitleHeader } from '../../features/character-scripts/google-doc-title-writer';
import { createAppsScriptDriveApi } from '../../platform/apps-script/drive-api';

function createAppsScriptBlobReader(): DriveBlobReader {
  return {
    getBytes(fileId) {
      return DriveApp.getFileById(fileId).getBlob().getBytes();
    },
  };
}

export function createCharacterScriptsActionDependencies(): CharacterScriptsActionDependencies {
  const budget = createActionProcessBudget();
  const driveApi = createAppsScriptDriveApi();
  return {
    drive: driveApi,
    blobReader: createAppsScriptBlobReader(),
    budget,
    writeGoogleDoc(file, project) {
      return writeGoogleDocTitleHeader(file, project, DocumentApp);
    },
  };
}
