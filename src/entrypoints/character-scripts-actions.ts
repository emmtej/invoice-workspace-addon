import { handleWriteCharacterScriptTitleHeaders } from '../features/character-scripts/character-scripts-actions';
import { createCharacterScriptsActionDependencies } from '../runtime/apps-script/character-scripts-dependencies';

export function onWriteCharacterScriptTitleHeaders(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  return handleWriteCharacterScriptTitleHeaders(
    event,
    createCharacterScriptsActionDependencies(),
  );
}
