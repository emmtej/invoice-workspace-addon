import { runWithTryLock, type TryLock } from '../../shared/locks';

export const INVOICE_RATE_SETTINGS_STORAGE_KEY =
  'invoiceWorkspace.invoice.rates.v2';

export const LEGACY_INVOICE_RATE_SETTINGS_STORAGE_KEY =
  'invoiceWorkspace.invoice.rates.v1';

export const INVOICE_RATE_SETTINGS_LOCK_TIMEOUT_MS = 1_500;

const RATE_PATTERN = /^(?:(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?|\.\d{1,6})$/;

export const INVOICE_CURRENCIES = ['USD', 'EUR'] as const;

export type InvoiceCurrency = (typeof INVOICE_CURRENCIES)[number];

export interface InvoiceRateSettings {
  translationRate: string;
  voiceOverRate: string;
  currency: InvoiceCurrency;
}

export const DEFAULT_INVOICE_RATE_SETTINGS = Object.freeze({
  translationRate: '',
  voiceOverRate: '',
  currency: 'USD' as InvoiceCurrency,
});

export interface InvoiceRatePropertyStore {
  getProperty(key: string): string | null | undefined;
  setProperty(key: string, value: string): void;
}

export type InvoiceRateSettingsLock = TryLock;

export interface InvoiceRateSettingsStore {
  get(): InvoiceRateSettings;
  set(settings: InvoiceRateSettings): InvoiceRateSettings;
}

function defaultSettings(): InvoiceRateSettings {
  return { ...DEFAULT_INVOICE_RATE_SETTINGS };
}

export function normalizeInvoiceRate(input: string, label: string): string {
  const value = input.trim();
  if (!RATE_PATTERN.test(value)) {
    throw new Error(
      `${label} must be a non-negative decimal no greater than 999999.999999, with at most 6 decimal places.`,
    );
  }

  const [whole, fraction = ''] = value.split('.');
  const normalizedWhole = whole || '0';
  const normalizedFraction = fraction.replace(/0+$/, '');
  return normalizedFraction.length > 0
    ? `${normalizedWhole}.${normalizedFraction}`
    : normalizedWhole;
}

function normalizeSettings(settings: InvoiceRateSettings): InvoiceRateSettings {
  if (!INVOICE_CURRENCIES.includes(settings.currency)) {
    throw new Error('Currency must be USD or EUR.');
  }
  return {
    translationRate: normalizeInvoiceRate(
      settings.translationRate,
      'Translation rate',
    ),
    voiceOverRate: normalizeInvoiceRate(
      settings.voiceOverRate,
      'Voice Over rate',
    ),
    currency: settings.currency,
  };
}

export function decodeInvoiceRateSettings(
  raw: string | null | undefined,
): InvoiceRateSettings {
  if (!raw) {
    return defaultSettings();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultSettings();
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    typeof (parsed as { translationRate?: unknown }).translationRate !==
      'string' ||
    typeof (parsed as { voiceOverRate?: unknown }).voiceOverRate !== 'string'
  ) {
    return defaultSettings();
  }

  try {
    const candidate = parsed as {
      translationRate: string;
      voiceOverRate: string;
      currency?: unknown;
    };
    return normalizeSettings({
      translationRate: candidate.translationRate,
      voiceOverRate: candidate.voiceOverRate,
      currency:
        candidate.currency === undefined
          ? DEFAULT_INVOICE_RATE_SETTINGS.currency
          : (candidate.currency as InvoiceCurrency),
    });
  } catch {
    return defaultSettings();
  }
}

export function createInvoiceRateSettingsStore(
  properties: InvoiceRatePropertyStore,
  lock: InvoiceRateSettingsLock,
): InvoiceRateSettingsStore {
  return {
    get() {
      const current = properties.getProperty(INVOICE_RATE_SETTINGS_STORAGE_KEY);
      return decodeInvoiceRateSettings(
        current ??
          properties.getProperty(LEGACY_INVOICE_RATE_SETTINGS_STORAGE_KEY),
      );
    },
    set(settings) {
      return runWithTryLock(
        lock,
        INVOICE_RATE_SETTINGS_LOCK_TIMEOUT_MS,
        'Settings are busy. Retry.',
        () => {
          const normalized = normalizeSettings(settings);
          properties.setProperty(
            INVOICE_RATE_SETTINGS_STORAGE_KEY,
            JSON.stringify(normalized),
          );
          return { ...normalized };
        },
      );
    },
  };
}

export function createUserPropertiesInvoiceRateSettingsStore(): InvoiceRateSettingsStore {
  const userProperties = PropertiesService.getUserProperties();
  return createInvoiceRateSettingsStore(
    {
      getProperty: (key) => userProperties.getProperty(key),
      setProperty: (key, value) => userProperties.setProperty(key, value),
    },
    LockService.getUserLock(),
  );
}
