export const OPEN_INVOICE_PROJECT_SCRIPTS_ACTION =
  'onOpenInvoiceProjectScripts';
export const CHANGE_INVOICE_PAGE_ACTION = 'onChangeInvoicePage';
export const CHANGE_INVOICE_PROJECT_SCRIPTS_PAGE_ACTION =
  'onChangeInvoiceProjectScriptsPage';
export const APPLY_INVOICE_PROJECT_SCRIPT_RESULTS_ACTION =
  'onApplyInvoiceProjectScriptResults';
export const OPEN_INVOICE_SCRIPT_LINE_AUDIT_ACTION =
  'onOpenInvoiceScriptLineAudit';
export const CHANGE_INVOICE_SCRIPT_LINE_AUDIT_PAGE_ACTION =
  'onChangeInvoiceScriptLineAuditPage';
export const FINALIZE_INVOICE_ACTION = 'onFinalizeInvoice';
export const INVOICE_SETTINGS_ACTIONS = {
  open: 'onOpenInvoiceSettings',
  save: 'onSaveInvoiceSettings',
} as const;

export const INVOICE_SETTINGS_FIELDS = {
  translationRate: 'invoiceRates.translation',
  voiceOverRate: 'invoiceRates.voiceOver',
  currency: 'invoiceRates.currency',
} as const;

export const INVOICE_DOCUMENT_ID_PARAMETER = 'invoiceDocumentId';
export const INVOICE_PAGE_PARAMETER = 'invoicePage';
export const PROJECT_FOLDER_ID_PARAMETER = 'projectFolderId';
export const PROJECT_NUMBER_PARAMETER = 'projectNumber';
export const PROJECT_TITLE_PARAMETER = 'projectTitle';
export const SCRIPT_COLLECTION_PARAMETER = 'scriptCollection';
export const PARSING_SIGNATURE_PARAMETER = 'parsingSignature';
export const SCRIPT_FILE_ID_PARAMETER = 'scriptFileId';
export const SCRIPT_LINE_AUDIT_FILTER_PARAMETER = 'scriptLineAuditFilter';
export const SCRIPT_RESULTS_PAGE_PARAMETER = 'scriptResultsPage';
