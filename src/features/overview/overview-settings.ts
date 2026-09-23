import {
  displayCharacterName,
  normalizeCharacterName,
} from './character-scripts';
import { utf8ByteLength } from '../../shared/utf8';
import { runWithTryLock, type TryLock } from '../../shared/locks';

export const ADDITIONAL_CHARACTER_CHECK_STORAGE_KEY =
  'invoiceWorkspace.overview.additionalCharacterCheck.v1';

export const ADDITIONAL_CHARACTER_CHECK_MAX_VALUE_LENGTH = 9 * 1024;

const ADDITIONAL_CHARACTER_CHECK_LOCK_TIMEOUT_MS = 1_500;

export interface AdditionalCharacterCheckSettings {
  enabled: boolean;
  characters: string[];
}

export const DEFAULT_ADDITIONAL_CHARACTER_CHECK_SETTINGS = Object.freeze({
  enabled: false,
  characters: Object.freeze([] as readonly string[]),
});

export interface SettingsPropertyStore {
  getProperty(key: string): string | null | undefined;
  setProperty(key: string, value: string): void;
}

export type SettingsLock = TryLock;

export interface AdditionalCharacterCheckStore {
  get(): AdditionalCharacterCheckSettings;
  setEnabled(enabled: boolean): AdditionalCharacterCheckSettings;
  setCharacters(
    characters: readonly string[],
  ): AdditionalCharacterCheckSettings;
}

function copySettings(settings: {
  enabled: boolean;
  characters: readonly string[];
}): AdditionalCharacterCheckSettings {
  return {
    enabled: settings.enabled,
    characters: [...settings.characters],
  };
}

function defaultSettings(): AdditionalCharacterCheckSettings {
  return copySettings(DEFAULT_ADDITIONAL_CHARACTER_CHECK_SETTINGS);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  );
}

function isSettingsRecord(
  value: unknown,
): value is { enabled: boolean; characters: string[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { enabled?: unknown }).enabled === 'boolean' &&
    isStringArray((value as { characters?: unknown }).characters)
  );
}

export function parseAdditionalCharacterList(input: string): string[] {
  return normalizeCharacterDisplayList(input.split(','));
}

function normalizeCharacterDisplayList(
  values: readonly string[],
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const display = displayCharacterName(value);
    if (display.length === 0) {
      continue;
    }

    const key = normalizeCharacterName(display);
    if (key.length === 0 || seen.has(key)) {
      continue;
    }

    seen.add(key);
    names.push(display);
  }

  return names;
}

export function decodeAdditionalCharacterCheckSettings(
  raw: string | null | undefined,
): AdditionalCharacterCheckSettings {
  if (raw == null || raw.length === 0) {
    return defaultSettings();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultSettings();
  }

  if (!isSettingsRecord(parsed)) {
    return defaultSettings();
  }

  return {
    enabled: parsed.enabled,
    characters: normalizeCharacterDisplayList(parsed.characters),
  };
}

function serializeSettings(settings: AdditionalCharacterCheckSettings): string {
  const payload = {
    enabled: settings.enabled,
    characters: settings.characters,
  };
  const serialized = JSON.stringify(payload);
  if (
    utf8ByteLength(serialized) >= ADDITIONAL_CHARACTER_CHECK_MAX_VALUE_LENGTH
  ) {
    throw new Error('Additional character list is too large to save.');
  }
  return serialized;
}

export function createAdditionalCharacterCheckStore(
  properties: SettingsPropertyStore,
  lock: SettingsLock,
): AdditionalCharacterCheckStore {
  const read = (): AdditionalCharacterCheckSettings =>
    decodeAdditionalCharacterCheckSettings(
      properties.getProperty(ADDITIONAL_CHARACTER_CHECK_STORAGE_KEY),
    );

  const write = (
    settings: AdditionalCharacterCheckSettings,
  ): AdditionalCharacterCheckSettings => {
    const next = copySettings(settings);
    properties.setProperty(
      ADDITIONAL_CHARACTER_CHECK_STORAGE_KEY,
      serializeSettings(next),
    );
    return next;
  };

  return {
    get() {
      return read();
    },
    setEnabled(enabled: boolean) {
      return runWithTryLock(
        lock,
        ADDITIONAL_CHARACTER_CHECK_LOCK_TIMEOUT_MS,
        'Settings are busy. Retry.',
        () => {
          const current = read();
          return write({
            enabled,
            characters: current.characters,
          });
        },
      );
    },
    setCharacters(characters: readonly string[]) {
      return runWithTryLock(
        lock,
        ADDITIONAL_CHARACTER_CHECK_LOCK_TIMEOUT_MS,
        'Settings are busy. Retry.',
        () => {
          const current = read();
          return write({
            enabled: current.enabled,
            characters: normalizeCharacterDisplayList(characters),
          });
        },
      );
    },
  };
}

export function createUserPropertiesAdditionalCharacterCheckStore(): AdditionalCharacterCheckStore {
  const userProperties = PropertiesService.getUserProperties();
  const lock = LockService.getUserLock();
  return createAdditionalCharacterCheckStore(
    {
      getProperty: (key) => userProperties.getProperty(key),
      setProperty: (key, value) => {
        userProperties.setProperty(key, value);
      },
    },
    lock,
  );
}
