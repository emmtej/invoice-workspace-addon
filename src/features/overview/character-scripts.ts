import type { SourceFileRecord } from '../../shared/drive-records';
import { GOOGLE_FOLDER_MIME_TYPE } from '../../shared/workspace-domain';

const GOOGLE_NATIVE_MIME_PREFIX = 'application/vnd.google-apps.';
const BINARY_EXTENSIONS = new Set([
  'doc',
  'docx',
  'fodt',
  'html',
  'md',
  'odt',
  'pages',
  'pdf',
  'rtf',
  'tex',
  'txt',
]);

export type CharacterRequirementSource = 'overview' | 'manual';

export interface CharacterRequirement {
  character: string;
  source: CharacterRequirementSource;
}

export interface CharacterMatch {
  key: string;
  displayName: string;
  source: CharacterRequirementSource;
  file: SourceFileRecord;
}

export interface AmbiguousCharacterMatch {
  key: string;
  displayName: string;
  source: CharacterRequirementSource;
  files: SourceFileRecord[];
}

export interface UnresolvedCharacter {
  key: string;
  displayName: string;
  source: CharacterRequirementSource;
}

export interface CharacterScriptMatchResult {
  overviewCount: number;
  ready: CharacterMatch[];
  missing: UnresolvedCharacter[];
  ambiguous: AmbiguousCharacterMatch[];
  ignoredFileCount: number;
}

export function parseDriveFolderId(
  url: string | undefined,
): string | undefined {
  if (!url) {
    return undefined;
  }

  const match = url
    .trim()
    .match(
      /^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)(?:[/?#].*)?$/i,
    );
  return match?.[1];
}

export function normalizeCharacterName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeSourceFileName(file: SourceFileRecord): string {
  let name = file.name.trim();
  if (!file.mimeType.startsWith(GOOGLE_NATIVE_MIME_PREFIX)) {
    const extensionMatch = name.match(/\.([^.\s]+)$/);
    if (
      extensionMatch &&
      BINARY_EXTENSIONS.has(extensionMatch[1].toLowerCase())
    ) {
      name = name.slice(0, -extensionMatch[0].length);
    }
  }
  return normalizeCharacterName(name);
}

export function displayCharacterName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function assembleCharacterRequirements(
  overviewCharacters: readonly string[],
  manualCharacters: readonly string[] = [],
): CharacterRequirement[] {
  const required = new Map<string, CharacterRequirement>();
  const sources: Array<{
    names: readonly string[];
    source: CharacterRequirementSource;
  }> = [
    { names: overviewCharacters, source: 'overview' },
    { names: manualCharacters, source: 'manual' },
  ];

  for (const { names, source } of sources) {
    for (const name of names) {
      const displayName = displayCharacterName(name);
      const key = normalizeCharacterName(displayName);
      if (!key || required.has(key)) {
        continue;
      }
      required.set(key, { character: displayName, source });
    }
  }

  return [...required.values()];
}

function keyFromSourceFileName(
  file: SourceFileRecord,
): string | undefined {
  if (file.mimeType === GOOGLE_FOLDER_MIME_TYPE) {
    return undefined;
  }
  return normalizeSourceFileName(file);
}

function indexRequirements(
  requirements: readonly CharacterRequirement[],
): Map<string, CharacterRequirement> {
  const required = new Map<string, CharacterRequirement>();
  for (const requirement of requirements) {
    const displayName = displayCharacterName(requirement.character);
    const key = normalizeCharacterName(displayName);
    if (!key || required.has(key)) {
      continue;
    }
    required.set(key, { character: displayName, source: requirement.source });
  }
  return required;
}

export function matchCharacterRequirements(
  requirements: readonly CharacterRequirement[],
  files: readonly SourceFileRecord[],
  keyForFile: (
    file: SourceFileRecord,
  ) => string | undefined = keyFromSourceFileName,
): CharacterScriptMatchResult {
  const required = indexRequirements(requirements);
  const candidates = new Map<string, SourceFileRecord[]>();
  let ignoredFileCount = 0;
  for (const file of files) {
    const key = keyForFile(file);
    if (!key || !required.has(key)) {
      ignoredFileCount++;
      continue;
    }
    const matches = candidates.get(key) ?? [];
    matches.push(file);
    candidates.set(key, matches);
  }

  const ready: CharacterMatch[] = [];
  const missing: UnresolvedCharacter[] = [];
  const ambiguous: AmbiguousCharacterMatch[] = [];
  let overviewCount = 0;
  for (const [key, requirement] of required) {
    if (requirement.source === 'overview') {
      overviewCount++;
    }
    const matches = candidates.get(key) ?? [];
    const displayName = requirement.character;
    const source = requirement.source;
    if (matches.length === 0) {
      missing.push({ key, displayName, source });
    } else if (matches.length === 1) {
      ready.push({ key, displayName, source, file: matches[0] });
    } else {
      ambiguous.push({ key, displayName, source, files: matches });
    }
  }

  return {
    overviewCount,
    ready,
    missing,
    ambiguous,
    ignoredFileCount,
  };
}

export function createCharacterSetSignature(characters: string[]): string {
  const canonical = [...new Set(characters.map(normalizeCharacterName))]
    .filter(Boolean)
    .sort()
    .join('\u001f');
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index++) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}-${
    canonical ? canonical.split('\u001f').length : 0
  }`;
}
