import { buildDocsFileAccessCard } from '../features/overview/ui/docs-access-card';
import { toDocsAccessView } from '../features/overview/ui/docs-access-view';
import { toOverviewErrorView } from '../features/overview/ui/overview-error-view';
import { buildOverviewHomeCard } from '../features/overview/ui/overview-home-card';
import { toOverviewHomeView } from '../features/overview/ui/overview-home-view';
import { isOverviewDocumentName } from '../features/overview/overview-document';
import { loadOverviewWorkspace } from '../features/overview/workspace';
import {
  createDocsHomepageDependencies,
  type DocsHomepageDependencies,
} from '../runtime/apps-script/host-dependencies';
import { getErrorMessage } from '../shared/errors';
import { buildErrorCard } from '../ui/chrome';
import { buildWelcomeCard } from '../ui/welcome-card';
import { toWelcomeView } from '../ui/welcome-view';

export function onDocsHomepage(
  event: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.Card {
  return handleDocsHomepage(event, createDocsHomepageDependencies());
}

function handleDocsHomepage(
  event: GoogleAppsScript.Addons.EventObject,
  dependencies: DocsHomepageDependencies,
): GoogleAppsScript.Card_Service.Card {
  const docs = event.docs;
  if (docs && !docs.addonHasFileScopePermission) {
    return ungrantedDocsHomepage(docs);
  }

  const documentId = docs?.id;
  if (!docs || !documentId) {
    return docsWelcomeCard();
  }

  return grantedDocsHomepage(docs, documentId, dependencies);
}

function ungrantedDocsHomepage(
  docs: GoogleAppsScript.Addons.DocsEventObject,
): GoogleAppsScript.Card_Service.Card {
  const documentName = docs.title ?? '';
  if (documentName && !isOverviewDocumentName(documentName)) {
    return docsWelcomeCard();
  }
  return buildDocsFileAccessCard(toDocsAccessView());
}

function grantedDocsHomepage(
  docs: GoogleAppsScript.Addons.DocsEventObject,
  documentId: string,
  dependencies: DocsHomepageDependencies,
): GoogleAppsScript.Card_Service.Card {
  try {
    const documentName =
      docs.title ?? DocumentApp.openById(documentId).getName();
    if (!isOverviewDocumentName(documentName)) {
      return docsWelcomeCard();
    }
    return buildOverviewHomeCard(
      toOverviewHomeView(
        loadOverviewWorkspace(documentId, dependencies.overviewReader),
      ),
    );
  } catch (error) {
    return docsOverviewLoadErrorCard(error);
  }
}

function docsWelcomeCard(): GoogleAppsScript.Card_Service.Card {
  return buildWelcomeCard(toWelcomeView('docs'));
}

function docsOverviewLoadErrorCard(
  error: unknown,
): GoogleAppsScript.Card_Service.Card {
  return buildErrorCard(
    toOverviewErrorView(
      `Could not load this Overview document. ${getErrorMessage(error)}`,
      'docs',
    ),
  );
}
