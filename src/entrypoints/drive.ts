import {
  CharacterScriptsWorkspaceError,
  loadCharacterScriptsWorkspace,
} from '../features/character-scripts/character-scripts-workspace';
import { toCharacterScriptsErrorView } from '../features/character-scripts/ui/character-scripts-error-view';
import { buildProjectDashboardCard } from '../features/character-scripts/ui/project-dashboard-card';
import { toProjectDashboardView } from '../features/character-scripts/ui/project-dashboard-view';
import { toOverviewErrorView } from '../features/overview/ui/overview-error-view';
import { buildOverviewHomeCard } from '../features/overview/ui/overview-home-card';
import { toOverviewHomeView } from '../features/overview/ui/overview-home-view';
import { toInvoiceErrorView } from '../features/invoice/ui/invoice-error-view';
import { buildInvoiceHomeCard } from '../features/invoice/ui/invoice-home-card';
import { toInvoiceHomeView } from '../features/invoice/ui/invoice-home-view';
import { isInvoiceDocumentName } from '../features/invoice/invoice-document';
import { loadInvoiceWorkspace } from '../features/invoice/invoice-workspace';
import { isOverviewDocumentName } from '../features/overview/overview-document';
import { loadOverviewWorkspace } from '../features/overview/workspace';
import {
  createDriveItemsSelectedDependencies,
  type DriveItemsSelectedDependencies,
} from '../runtime/apps-script/host-dependencies';
import { getErrorMessage } from '../shared/errors';
import { getErrorLogContext, type LogContext } from '../shared/logging';
import { logEvent } from '../diagnostics/logging';
import { buildErrorCard } from '../ui/chrome';
import { buildWelcomeCard } from '../ui/welcome-card';
import { toWelcomeView } from '../ui/welcome-view';
import {
  GOOGLE_DOCS_MIME_TYPE,
  GOOGLE_FOLDER_MIME_TYPE,
  parseNumberedProjectName,
} from '../shared/workspace-domain';

const DRIVE_ITEMS_SELECTED_HANDLER = 'onDriveItemsSelected';

export function onDriveHomepage(
  _event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.Card {
  return driveWelcomeCard();
}

export function onDriveItemsSelected(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.Card {
  return handleDriveItemsSelected(
    event,
    createDriveItemsSelectedDependencies(),
  );
}

export function handleDriveItemsSelected(
  event: GoogleAppsScript.Addons.EventObject,
  dependencies: DriveItemsSelectedDependencies,
): GoogleAppsScript.Card_Service.Card {
  const activeItem = getDriveSelectedItem(event);
  if (!activeItem) {
    return skipDriveSelection('warning', 'active-cursor-item-missing');
  }

  const logContext = {
    handler: DRIVE_ITEMS_SELECTED_HANDLER,
    documentId: activeItem.id,
  };

  if (activeItem.mimeType === GOOGLE_FOLDER_MIME_TYPE) {
    if (!parseNumberedProjectName(activeItem.title ?? '')) {
      return skipDriveSelection('info', 'folder-name-is-not-numbered-project', {
        handler: DRIVE_ITEMS_SELECTED_HANDLER,
        mimeType: activeItem.mimeType,
      });
    }
    return characterScriptsSelectionCard(activeItem, dependencies);
  }

  if (activeItem.mimeType !== GOOGLE_DOCS_MIME_TYPE) {
    return skipDriveSelection('info', 'selected-item-is-not-google-doc', {
      ...logContext,
      mimeType: activeItem.mimeType,
    });
  }

  if (isInvoiceDocumentName(activeItem.title)) {
    return invoiceSelectionCard(activeItem, dependencies, logContext);
  }

  if (!isOverviewDocumentName(activeItem.title)) {
    return skipDriveSelection(
      'info',
      'document-name-is-not-overview',
      logContext,
    );
  }

  return overviewSelectionCard(activeItem, dependencies, logContext);
}

function getDriveSelectedItem(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Addons.DriveItemObject | undefined {
  return event.drive?.activeCursorItem;
}

function skipDriveSelection(
  level: 'info' | 'warning',
  reason: string,
  context: LogContext = {},
): GoogleAppsScript.Card_Service.Card {
  logEvent('drive.items-selected.skipped', level, {
    handler: DRIVE_ITEMS_SELECTED_HANDLER,
    ...context,
    reason,
  });
  return driveWelcomeCard();
}

function invoiceSelectionCard(
  item: GoogleAppsScript.Addons.DriveItemObject,
  dependencies: DriveItemsSelectedDependencies,
  logContext: LogContext,
): GoogleAppsScript.Card_Service.Card {
  try {
    return buildInvoiceHomeCard(
      toInvoiceHomeView(
        loadInvoiceWorkspace(item.id, dependencies.invoiceReader),
      ),
    );
  } catch (error) {
    logEvent('drive.items-selected.invoice-card-failed', 'error', {
      ...logContext,
      ...getErrorLogContext(error),
    });
    return buildErrorCard(
      toInvoiceErrorView(
        `Could not load the selected Invoice. ${getErrorMessage(error)}`,
        'load',
        item.id,
      ),
    );
  }
}

function characterScriptsSelectionCard(
  item: GoogleAppsScript.Addons.DriveItemObject,
  dependencies: DriveItemsSelectedDependencies,
): GoogleAppsScript.Card_Service.Card {
  try {
    const workspace = loadCharacterScriptsWorkspace(
      item.id,
      dependencies.characterScriptsDrive,
    );
    return buildProjectDashboardCard(toProjectDashboardView(workspace));
  } catch (error) {
    const reason =
      error instanceof CharacterScriptsWorkspaceError
        ? error.reason
        : 'load-failed';
    logEvent('drive.items-selected.character-scripts-card-failed', 'error', {
      handler: DRIVE_ITEMS_SELECTED_HANDLER,
      mimeType: item.mimeType,
      reason,
    });
    return buildErrorCard(toCharacterScriptsErrorView(reason));
  }
}

function overviewSelectionCard(
  item: GoogleAppsScript.Addons.DriveItemObject,
  dependencies: DriveItemsSelectedDependencies,
  logContext: LogContext,
): GoogleAppsScript.Card_Service.Card {
  try {
    return buildOverviewHomeCard(
      toOverviewHomeView(
        loadOverviewWorkspace(item.id, dependencies.overviewReader, logContext),
      ),
    );
  } catch (error) {
    logEvent('drive.items-selected.failed', 'error', {
      ...logContext,
      ...getErrorLogContext(error),
    });
    return buildErrorCard(
      toOverviewErrorView(
        `Could not parse the selected Overview document. ${getErrorMessage(error)}`,
        'drive',
      ),
    );
  }
}

function driveWelcomeCard(): GoogleAppsScript.Card_Service.Card {
  return buildWelcomeCard(toWelcomeView('drive'));
}
