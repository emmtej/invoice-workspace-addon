import type { FooterView } from '../../../ui/models';
import {
  INVOICE_DOCUMENT_ID_PARAMETER,
  INVOICE_SETTINGS_ACTIONS,
  INVOICE_SETTINGS_FIELDS,
} from '../invoice-action-ids';
import {
  INVOICE_CURRENCIES,
  type InvoiceRateSettings,
} from '../invoice-settings';

export interface InvoiceSettingsView {
  title: string;
  subtitle: string;
  ratesHeader: string;
  translation: InvoiceRateFieldView;
  voiceOver: InvoiceRateFieldView;
  currencyFieldName: string;
  currencyTitle: string;
  currencyItems: readonly { label: string; value: string; selected: boolean }[];
  footer: FooterView;
}

export interface InvoiceRateFieldView {
  fieldName: string;
  title: string;
  value: string;
}

export function toInvoiceSettingsView(
  settings: InvoiceRateSettings,
  invoiceDocumentId: string,
): InvoiceSettingsView {
  return {
    title: 'Invoice settings',
    subtitle: 'Used when you finalize',
    ratesHeader: 'Per-word rates',
    translation: {
      fieldName: INVOICE_SETTINGS_FIELDS.translationRate,
      title: 'Translation',
      value: settings.translationRate,
    },
    voiceOver: {
      fieldName: INVOICE_SETTINGS_FIELDS.voiceOverRate,
      title: 'Voice Over',
      value: settings.voiceOverRate,
    },
    currencyFieldName: INVOICE_SETTINGS_FIELDS.currency,
    currencyTitle: 'Currency',
    currencyItems: INVOICE_CURRENCIES.map((currency) => ({
      label: currency,
      value: currency,
      selected: settings.currency === currency,
    })),
    footer: {
      primary: {
        label: 'Save',
        altText: 'Save invoice rates and currency',
        style: 'filled',
        action: {
          functionName: INVOICE_SETTINGS_ACTIONS.save,
          parameters: {
            [INVOICE_DOCUMENT_ID_PARAMETER]: invoiceDocumentId,
          },
        },
      },
    },
  };
}
