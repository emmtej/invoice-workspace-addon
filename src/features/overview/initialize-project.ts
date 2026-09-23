import {
  planInitializationCopies,
  executeInitializationCopies,
} from './initialize-copy';
import {
  buildInitializationFailureResponse,
  buildInitializationResponse,
  buildProjectInitializationResult,
  type InitializationResponseDependencies,
} from './initialize-response';
import { resolveDestination } from './initialize-destination';
import type {
  MutationContext,
  InitializationRunContext,
  ProjectInitializationDependencies,
} from './initialize-model';
import { parseDriveFolderId } from './character-scripts';
import type { OverviewProjectItem } from './model';
import { loadOverviewProjectItems } from './overview-document';
import type { WorkspaceDriveReader } from './workspace-reader';
import { createActionProcessBudget } from '../../shared/action-process-budget';
import { buildNotificationResponse } from '../../ui/navigation';

interface InitializeParameters {
  documentId: string;
  projectNumber: number;
  expectedTitle: string;
}

export function readInitializeParameters(
  event: GoogleAppsScript.Addons.EventObject,
): InitializeParameters {
  const parameters = event.commonEventObject?.parameters ?? {};
  const documentId = parameters.overviewDocumentId;
  const projectNumberText = parameters.projectNumber;
  const expectedTitle = parameters.expectedTitle;
  const projectNumber = Number(projectNumberText);
  if (
    !documentId ||
    !projectNumberText ||
    !Number.isSafeInteger(projectNumber) ||
    projectNumber < 0 ||
    !expectedTitle
  ) {
    throw new Error('Missing or invalid initialization parameters.');
  }
  return { documentId, projectNumber, expectedTitle };
}

function findTrustedItem(
  items: OverviewProjectItem[],
  projectNumber: number,
  expectedTitle: string,
): OverviewProjectItem {
  const matches = items.filter((item) => item.number === projectNumber);
  if (matches.length !== 1 || matches[0].title !== expectedTitle) {
    throw new Error('Overview project changed. Reload the card and try again.');
  }
  return matches[0];
}

export function initializeProjectItem(
  context: InitializationRunContext,
  item: OverviewProjectItem,
  dependencies: ProjectInitializationDependencies,
): string {
  if (!context.budget.canContinue()) {
    return `Project ${item.number} was not started before the time limit.`;
  }

  const sourceFolderId = parseDriveFolderId(item.characterScriptsFolderUrl);
  if (!sourceFolderId) {
    return 'Valid character-scripts folder link required.';
  }

  const plan = planInitializationCopies(item, sourceFolderId, dependencies);

  if (!context.budget.canContinue()) {
    return `Project ${item.number} was not started before the time limit.`;
  }

  const destination = resolveDestination(context, item, dependencies);
  if (
    destination.conflict ||
    !destination.projectFolder ||
    !destination.originalScriptsFolder
  ) {
    return destination.conflict ?? 'Could not prepare project folders.';
  }

  const result = executeInitializationCopies(
    context,
    destination.originalScriptsFolder.id,
    plan,
    dependencies,
  );

  return buildProjectInitializationResult(
    item.number,
    plan.sourceMatches.overviewCount,
    result,
  );
}

export interface InitializeProjectHandlerDependencies {
  loadItems: typeof loadOverviewProjectItems;
  getOverviewParent: WorkspaceDriveReader['getOverviewParent'];
  initializeItem(
    context: InitializationRunContext,
    item: OverviewProjectItem,
  ): string;
  loadWorkspace: InitializationResponseDependencies['loadWorkspace'];
  reader: WorkspaceDriveReader;
}

const INVALID_INITIALIZATION_REQUEST =
  'Initialization request is invalid. Reload the card and try again.';

export function handleInitializeProject(
  event: GoogleAppsScript.Addons.EventObject,
  dependencies: InitializeProjectHandlerDependencies,
): GoogleAppsScript.Card_Service.ActionResponse {
  const budget = createActionProcessBudget();
  let parameters: InitializeParameters;
  try {
    parameters = readInitializeParameters(event);
  } catch (_error) {
    return buildNotificationResponse(INVALID_INITIALIZATION_REQUEST);
  }

  const mutation: MutationContext = { changed: false };
  const responseDependencies: InitializationResponseDependencies = {
    loadWorkspace: dependencies.loadWorkspace,
    reader: dependencies.reader,
  };
  try {
    const items = dependencies.loadItems(parameters.documentId);
    const item = findTrustedItem(
      items,
      parameters.projectNumber,
      parameters.expectedTitle,
    );
    const parent = dependencies.getOverviewParent(parameters.documentId);
    const context = {
      parentFolderId: parent.id,
      budget,
      mutation,
    };
    const result = dependencies.initializeItem(context, item);
    return buildInitializationResponse(
      parameters.documentId,
      result,
      mutation.changed,
      responseDependencies,
    );
  } catch (_error) {
    return buildInitializationFailureResponse(
      parameters.documentId,
      mutation,
      responseDependencies,
    );
  }
}
