import {
  createCharacterSetSignature,
  displayCharacterName,
  matchCharacterRequirements,
  normalizeCharacterName,
  normalizeSourceFileName,
  type CharacterRequirement,
  type CharacterScriptMatchResult,
} from './character-scripts';
import type { SourceFileRecord } from '../../shared/drive-records';
import { GOOGLE_FOLDER_MIME_TYPE } from '../../shared/workspace-domain';

export const SCRIPT_COPY_APP_PROPERTIES = {
  version: 'iwVersion',
  characterKey: 'iwCharacterKey',
  sourceFileId: 'iwSourceFileId',
} as const;

const SCRIPT_COPY_METADATA_VERSION = '2';

export function buildScriptCopyProperties(
  characterKey: string,
  sourceFileId: string,
): Record<string, string> {
  return {
    [SCRIPT_COPY_APP_PROPERTIES.version]: SCRIPT_COPY_METADATA_VERSION,
    [SCRIPT_COPY_APP_PROPERTIES.characterKey]: createCharacterSetSignature([
      characterKey,
    ]),
    [SCRIPT_COPY_APP_PROPERTIES.sourceFileId]: sourceFileId,
  };
}

export function matchDestinationCharacterRequirements(
  requirements: readonly CharacterRequirement[],
  files: SourceFileRecord[],
): CharacterScriptMatchResult {
  const requiredKeys = new Set(
    requirements
      .map((requirement) =>
        normalizeCharacterName(displayCharacterName(requirement.character)),
      )
      .filter(Boolean),
  );
  const signatureToKey = new Map<string, string>();
  for (const key of requiredKeys) {
    signatureToKey.set(createCharacterSetSignature([key]), key);
  }

  return matchCharacterRequirements(requirements, files, (file) => {
    if (file.mimeType === GOOGLE_FOLDER_MIME_TYPE) {
      return undefined;
    }
    const properties = file.appProperties ?? {};
    const taggedCharacter =
      properties[SCRIPT_COPY_APP_PROPERTIES.version] ===
      SCRIPT_COPY_METADATA_VERSION
        ? properties[SCRIPT_COPY_APP_PROPERTIES.characterKey]
        : undefined;
    if (taggedCharacter) {
      return signatureToKey.get(taggedCharacter);
    }
    return normalizeSourceFileName(file);
  });
}
