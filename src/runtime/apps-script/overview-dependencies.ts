import { createActionProcessBudget } from '../../shared/action-process-budget';
import type { DriveApi } from '../../shared/drive/drive-api';
import {
  initializeProjectItem,
  type InitializeProjectHandlerDependencies,
} from '../../features/overview/initialize-project';
import { type ProjectInitializationDependencies } from '../../features/overview/initialize-model';
import {
  CREATE_INVOICE_LOCK_MESSAGE,
  type CreateInvoiceDependencies,
} from '../../features/overview/invoice-create';
import { loadOverviewProjectItems } from '../../features/overview/overview-document';
import {
  type ClearProjectScriptPropertiesActionDependencies,
  type OverviewSettingsActionDependencies,
} from '../../features/overview/overview-settings-actions';
import { createUserPropertiesAdditionalCharacterCheckStore } from '../../features/overview/overview-settings';
import {
  clearProjectScriptAppProperties,
  type ProjectScriptPropertiesDependencies,
} from '../../features/overview/project-script-properties';
import {
  copyDriveFile,
  createDriveFolder,
  createInvoiceDocument,
  createWorkspaceDriveReader,
  listFolderRecords,
  listInvoiceCandidates,
  listSourceFiles,
} from '../../features/overview/workspace-drive';
import { loadOverviewWorkspace } from '../../features/overview/workspace';
import { createAppsScriptDriveApi } from '../../platform/apps-script/drive-api';
import { runWithAppsScriptScriptLock } from '../../platform/apps-script/locks';

const INITIALIZE_PROJECT_LOCK_MESSAGE =
  'Workspace is busy. Retry initialization.';
const CLEAR_PROJECT_PROPERTIES_LOCK_MESSAGE =
  'Workspace is busy. Retry metadata removal.';
const OVERVIEW_MUTATION_LOCK_TIMEOUT_MS = 1_500;

export function createInitializeProjectDependencies(): InitializeProjectHandlerDependencies {
  const driveApi = createAppsScriptDriveApi();
  const reader = createWorkspaceDriveReader(driveApi);
  const projectDependencies = createProjectInitializationDependencies(driveApi);

  return {
    loadItems: loadOverviewProjectItems,
    getOverviewParent: reader.getOverviewParent,
    initializeItem: (context, item) =>
      initializeProjectItem(context, item, projectDependencies),
    loadWorkspace: loadOverviewWorkspace,
    reader,
  };
}

function createProjectInitializationDependencies(
  driveApi: DriveApi,
): ProjectInitializationDependencies {
  return {
    listFolderRecords: (parentFolderId) =>
      listFolderRecords(parentFolderId, driveApi),
    listSourceFiles: (folderId) => listSourceFiles(folderId, driveApi),
    createDriveFolder: (name, parentFolderId) =>
      createDriveFolder(name, parentFolderId, driveApi),
    copyDriveFile: (source, destinationFolderId, appProperties) =>
      copyDriveFile(source, destinationFolderId, appProperties, driveApi),
    withLock: (operation) =>
      runWithAppsScriptScriptLock(
        OVERVIEW_MUTATION_LOCK_TIMEOUT_MS,
        INITIALIZE_PROJECT_LOCK_MESSAGE,
        operation,
      ),
    getSettings: () =>
      createUserPropertiesAdditionalCharacterCheckStore().get(),
  };
}

export function createCreateInvoiceDependencies(): CreateInvoiceDependencies {
  const driveApi = createAppsScriptDriveApi();
  const reader = createWorkspaceDriveReader(driveApi);

  return {
    withLock: (operation) =>
      runWithAppsScriptScriptLock(
        OVERVIEW_MUTATION_LOCK_TIMEOUT_MS,
        CREATE_INVOICE_LOCK_MESSAGE,
        operation,
      ),
    loadItems: loadOverviewProjectItems,
    getOverviewParent: reader.getOverviewParent,
    listInvoiceCandidates: (parentFolderId) =>
      listInvoiceCandidates(parentFolderId, driveApi),
    createInvoiceDocument: (parentFolderId) =>
      createInvoiceDocument(parentFolderId, driveApi),
    writeInvoiceBody: (documentId, body) =>
      DocumentApp.openById(documentId).getBody().setText(body),
    trashDocument: (documentId) => driveApi.trashFile(documentId),
    formatToday: () =>
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yy'),
    loadWorkspace: loadOverviewWorkspace,
    reader,
  };
}

export function createOverviewSettingsActionDependencies(): OverviewSettingsActionDependencies {
  return {
    store: createUserPropertiesAdditionalCharacterCheckStore(),
  };
}

export function createClearProjectScriptPropertiesActionDependencies(): ClearProjectScriptPropertiesActionDependencies {
  const driveApi = createAppsScriptDriveApi();
  const reader = createWorkspaceDriveReader(driveApi);
  const budget = createActionProcessBudget();
  const store = createUserPropertiesAdditionalCharacterCheckStore();
  const clearDependencies: ProjectScriptPropertiesDependencies = {
    loadItems: loadOverviewProjectItems,
    getOverviewParent: reader.getOverviewParent,
    listFolderRecords: (parentFolderId) =>
      listFolderRecords(parentFolderId, driveApi),
    listSourceFiles: (folderId) => listSourceFiles(folderId, driveApi),
    clearFileAppProperties: (fileId, propertyKeys) =>
      driveApi.clearFileAppProperties(fileId, propertyKeys),
    canContinue: () => budget.canContinue(),
    withLock: (operation) =>
      runWithAppsScriptScriptLock(
        OVERVIEW_MUTATION_LOCK_TIMEOUT_MS,
        CLEAR_PROJECT_PROPERTIES_LOCK_MESSAGE,
        operation,
      ),
  };
  return {
    store,
    clearProjectScriptProperties: (documentId) =>
      clearProjectScriptAppProperties(documentId, clearDependencies),
  };
}
