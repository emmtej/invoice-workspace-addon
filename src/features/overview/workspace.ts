import { unknownInvoice, loadInvoiceState } from './workspace-invoice-state';
import {
  compareItemsToFolderInventory,
  createUnknownWorkspaceItems,
  type CanContinueInspection,
} from './workspace-inspection';
import type {
  OverviewParentFolder,
  WorkspaceDriveReader,
} from './workspace-reader';
import type { OverviewProjectItem, OverviewWorkspace } from './model';
import { loadOverviewProjectItems } from './overview-document';
import { getErrorLogContext, type LogContext } from '../../shared/logging';
import { logEvent } from '../../diagnostics/logging';
import { createActionProcessBudget } from '../../shared/action-process-budget';

const DEFAULT_WORKSPACE_INSPECTION_BUDGET_MS = 8_000;

export function inspectParsedOverviewWorkspace(
  documentId: string,
  items: OverviewProjectItem[],
  drive: WorkspaceDriveReader,
  logContext: LogContext = {},
  canContinue: CanContinueInspection = () => true,
): OverviewWorkspace {
  if (!canContinue()) {
    logEvent('workspace.inspection.time-budget-reached', 'warning', {
      ...logContext,
      documentId,
      stage: 'before-parent-inspection',
    });
    return {
      documentId,
      items: createUnknownWorkspaceItems(items),
      inspectionError: 'Workspace inspection time limit reached.',
      invoice: unknownInvoice('time-budget-reached'),
    };
  }

  let parent: OverviewParentFolder;
  try {
    parent = drive.getOverviewParent(documentId);
  } catch (error) {
    logEvent('workspace.inspection.failed', 'error', {
      ...logContext,
      documentId,
      ...getErrorLogContext(error),
    });
    return {
      documentId,
      items: createUnknownWorkspaceItems(items),
      inspectionError: 'Workspace folder status is unavailable.',
      invoice: unknownInvoice('lookup-failed'),
    };
  }

  if (!canContinue()) {
    logEvent('workspace.inspection.time-budget-reached', 'warning', {
      ...logContext,
      documentId,
      parentFolderId: parent.id,
      stage: 'before-invoice-lookup',
    });
    return {
      documentId,
      parentFolderId: parent.id,
      parentFolderName: parent.name,
      items: createUnknownWorkspaceItems(items),
      inspectionError: 'Workspace inspection time limit reached.',
      invoice: unknownInvoice('time-budget-reached'),
    };
  }

  const invoice = loadInvoiceState(documentId, parent.id, drive, logContext);

  if (!canContinue()) {
    logEvent('workspace.inspection.time-budget-reached', 'warning', {
      ...logContext,
      documentId,
      parentFolderId: parent.id,
      stage: 'before-parent-folder-inventory',
    });
    return {
      documentId,
      parentFolderId: parent.id,
      parentFolderName: parent.name,
      items: createUnknownWorkspaceItems(items),
      inspectionError: 'Workspace inspection time limit reached.',
      invoice,
    };
  }

  try {
    const folders = drive.listChildFolders(parent.id);
    const workspace: OverviewWorkspace = {
      documentId,
      parentFolderId: parent.id,
      parentFolderName: parent.name,
      items: compareItemsToFolderInventory(
        documentId,
        items,
        folders,
        drive,
        logContext,
        canContinue,
      ),
      invoice,
    };
    if (workspace.items.some((item) => item.workspace.status === 'unknown')) {
      workspace.inspectionError =
        'Some workspace folder statuses are unavailable.';
    }
    return workspace;
  } catch (error) {
    logEvent('workspace.inspection.failed', 'error', {
      ...logContext,
      documentId,
      parentFolderId: parent.id,
      ...getErrorLogContext(error),
    });
    return {
      documentId,
      parentFolderId: parent.id,
      parentFolderName: parent.name,
      items: createUnknownWorkspaceItems(items),
      inspectionError: 'Workspace folder status is unavailable.',
      invoice,
    };
  }
}

export function loadOverviewWorkspace(
  documentId: string,
  drive: WorkspaceDriveReader,
  logContext: LogContext = {},
): OverviewWorkspace {
  const budget = createActionProcessBudget({
    durationMs: DEFAULT_WORKSPACE_INSPECTION_BUDGET_MS,
  });
  const items = loadOverviewProjectItems(documentId, logContext);
  return inspectParsedOverviewWorkspace(
    documentId,
    items,
    drive,
    logContext,
    () => budget.canContinue(),
  );
}
