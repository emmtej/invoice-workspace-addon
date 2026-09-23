import type { InitializationCopyResult } from './initialize-copy';
import type { MutationContext } from './initialize-model';
import type { loadOverviewWorkspace } from './workspace';
import type { WorkspaceDriveReader } from './workspace-reader';
import { buildOverviewHomeCard } from './ui/overview-home-card';
import { toOverviewHomeView } from './ui/overview-home-view';
import {
  buildNotificationResponse,
  updateCardResponse,
} from '../../ui/navigation';

function withOptionalWarning(message: string, optional: string): string {
  return optional ? `${message} Optional: ${optional}` : message;
}

function withManualFoundFeedback(
  message: string,
  manualCharacters: string[],
): string {
  if (manualCharacters.length === 0) {
    return message;
  }
  const label =
    manualCharacters.length === 1
      ? 'Additional character found'
      : 'Additional characters found';
  return `${message} ${label}: ${manualCharacters.join(', ')}.`;
}

export interface InitializationResponseDependencies {
  loadWorkspace: typeof loadOverviewWorkspace;
  reader: WorkspaceDriveReader;
}

export function buildInitializationResponse(
  documentId: string,
  message: string,
  changed: boolean,
  dependencies: InitializationResponseDependencies,
): GoogleAppsScript.Card_Service.ActionResponse {
  const workspace = dependencies.loadWorkspace(documentId, dependencies.reader);
  return updateCardResponse(
    buildOverviewHomeCard(toOverviewHomeView(workspace)),
    {
      message,
      stateChanged: changed,
    },
  );
}

export function buildInitializationFailureResponse(
  documentId: string,
  mutation: MutationContext,
  dependencies: InitializationResponseDependencies,
): GoogleAppsScript.Card_Service.ActionResponse {
  const message = 'Initialization failed. Check Drive access and retry.';
  try {
    return buildInitializationResponse(
      documentId,
      message,
      mutation.changed,
      dependencies,
    );
  } catch (_refreshError) {
    return buildNotificationResponse(message, {
      stateChanged: mutation.changed,
    });
  }
}

export function buildProjectInitializationResult(
  projectNumber: number,
  overviewCount: number,
  result: InitializationCopyResult,
): string {
  const {
    copiedThisRun,
    satisfiedCount,
    complete,
    unresolved,
    optional,
    manualCharactersFound,
  } = result;
  if (complete) {
    const message =
      copiedThisRun > 0
        ? `Project ${projectNumber} initialized. ${copiedThisRun} script${copiedThisRun === 1 ? '' : 's'} copied.`
        : `Project ${projectNumber} is already initialized.`;
    return withOptionalWarning(
      withManualFoundFeedback(message, manualCharactersFound),
      optional,
    );
  }
  return `Project ${projectNumber}: ${satisfiedCount} of ${overviewCount} scripts present. Initialization incomplete.${
    unresolved ? ` ${unresolved}` : ''
  }`;
}
