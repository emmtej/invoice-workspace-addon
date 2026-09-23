import type { SourceFileRecord } from '../../shared/drive-records';
import { type ApplyInvoiceProjectScriptResultsDependencies } from '../../features/invoice/invoice-apply-actions';
import { type FinalizeInvoiceDependencies } from '../../features/invoice/invoice-finalize-actions';
import {
  createInvoiceWorkspaceDriveReader,
  createInvoiceWorkspaceDriveWriter,
} from '../../features/invoice/invoice-drive';
import type { InvoiceSettingsActionDependencies } from '../../features/invoice/invoice-settings-actions';
import { createUserPropertiesInvoiceRateSettingsStore } from '../../features/invoice/invoice-settings';
import type { InvoiceScriptContentReader } from '../../features/invoice/invoice-script-results';
import {
  createAppsScriptScriptContentReader,
  readScriptContent,
} from '../../features/invoice/script-content-reader';
import type { InvoiceWorkspaceReader } from '../../features/invoice/invoice-workspace';
import { createAppsScriptDriveApi } from '../../platform/apps-script/drive-api';
import { runWithAppsScriptUserLock } from '../../platform/apps-script/locks';

const APPLY_RESULTS_LOCK_MESSAGE =
  'Another Invoice update is running for your account. Retry applying parsing results.';
const FINALIZE_INVOICE_LOCK_MESSAGE =
  'Another Invoice update is running for your account. Retry finalizing the Invoice.';
const INVOICE_MUTATION_LOCK_TIMEOUT_MS = 1_500;

export interface InvoiceScriptActionDependencies {
  reader: InvoiceWorkspaceReader;
  readContent: InvoiceScriptContentReader;
}

export function createInvoicePageReader(): InvoiceWorkspaceReader {
  return createInvoiceWorkspaceDriveReader(createAppsScriptDriveApi());
}

export function createInvoiceScriptActionDependencies(): InvoiceScriptActionDependencies {
  const driveApi = createAppsScriptDriveApi();
  const scriptContentDependencies = createAppsScriptScriptContentReader();
  return {
    reader: createInvoiceWorkspaceDriveReader(driveApi),
    readContent: (file: SourceFileRecord) =>
      readScriptContent(file, scriptContentDependencies),
  };
}

export function createApplyInvoiceProjectScriptResultsDependencies(): ApplyInvoiceProjectScriptResultsDependencies {
  const driveApi = createAppsScriptDriveApi();
  const scriptContentDependencies = createAppsScriptScriptContentReader();
  return {
    reader: createInvoiceWorkspaceDriveReader(driveApi),
    writer: createInvoiceWorkspaceDriveWriter(driveApi),
    readContent: (file: SourceFileRecord) =>
      readScriptContent(file, scriptContentDependencies),
    withLock: (operation) =>
      runWithAppsScriptUserLock(
        INVOICE_MUTATION_LOCK_TIMEOUT_MS,
        APPLY_RESULTS_LOCK_MESSAGE,
        operation,
      ),
  };
}

export function createFinalizeInvoiceDependencies(): FinalizeInvoiceDependencies {
  const driveApi = createAppsScriptDriveApi();
  return {
    reader: createInvoiceWorkspaceDriveReader(driveApi),
    writer: createInvoiceWorkspaceDriveWriter(driveApi),
    settingsStore: createUserPropertiesInvoiceRateSettingsStore(),
    withLock: (operation) =>
      runWithAppsScriptUserLock(
        INVOICE_MUTATION_LOCK_TIMEOUT_MS,
        FINALIZE_INVOICE_LOCK_MESSAGE,
        operation,
      ),
  };
}

export function createInvoiceSettingsActionDependencies(): InvoiceSettingsActionDependencies {
  return {
    store: createUserPropertiesInvoiceRateSettingsStore(),
  };
}
