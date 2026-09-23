import { createInvoiceWorkspaceDriveReader } from '../../features/invoice/invoice-drive';
import type { InvoiceWorkspaceReader } from '../../features/invoice/invoice-workspace';
import { createWorkspaceDriveReader } from '../../features/overview/workspace-drive';
import type { WorkspaceDriveReader } from '../../features/overview/workspace-reader';
import type { DriveApi } from '../../shared/drive/drive-api';
import { createAppsScriptDriveApi } from '../../platform/apps-script/drive-api';

export interface DriveItemsSelectedDependencies {
  invoiceReader: InvoiceWorkspaceReader;
  overviewReader: WorkspaceDriveReader;
  characterScriptsDrive: Pick<DriveApi, 'getFile' | 'listChildren'>;
}

export interface DocsHomepageDependencies {
  overviewReader: WorkspaceDriveReader;
}

export function createDriveItemsSelectedDependencies(): DriveItemsSelectedDependencies {
  const driveApi = createAppsScriptDriveApi();
  return {
    invoiceReader: createInvoiceWorkspaceDriveReader(driveApi),
    overviewReader: createWorkspaceDriveReader(driveApi),
    characterScriptsDrive: driveApi,
  };
}

export function createDocsHomepageDependencies(): DocsHomepageDependencies {
  const driveApi = createAppsScriptDriveApi();
  return {
    overviewReader: createWorkspaceDriveReader(driveApi),
  };
}
