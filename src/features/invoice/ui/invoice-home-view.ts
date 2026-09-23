import type {
  CardActionSpec,
  FooterView,
  PagingView,
  SettingsCogView,
} from '../../../ui/models';
import { toPagingView } from '../../../ui/paging';
import { toSettingsCogView } from '../../../ui/settings-cog';
import {
  CHANGE_INVOICE_PAGE_ACTION,
  FINALIZE_INVOICE_ACTION,
  INVOICE_DOCUMENT_ID_PARAMETER,
  INVOICE_PAGE_PARAMETER,
  INVOICE_SETTINGS_ACTIONS,
  OPEN_INVOICE_PROJECT_SCRIPTS_ACTION,
  PROJECT_FOLDER_ID_PARAMETER,
  PROJECT_NUMBER_PARAMETER,
  PROJECT_TITLE_PARAMETER,
  SCRIPT_COLLECTION_PARAMETER,
} from '../invoice-action-ids';
import { INVOICE_PROJECT_PAGE_SIZE, getCardPage } from '../invoice-card-page';
import type {
  InvoiceScriptCollection,
  InvoiceWorkspaceItem,
} from '../invoice-projects';
import {
  describeInvoiceWorkspaceItemFolder,
  type InvoiceWorkspace,
} from '../invoice-workspace';
import { openInvoiceFooterButton } from './invoice-chrome';

export interface InvoiceParseButtonView {
  label: string;
  altText: string;
  action: CardActionSpec;
}

export interface InvoiceProjectRowView {
  topLabel: string;
  title: string;
  wordLines: readonly string[];
  folderProblem?: string;
  recovery?: string;
  parseOriginal?: InvoiceParseButtonView;
  parseTranslated?: InvoiceParseButtonView;
}

export interface InvoiceHomeView {
  title: string;
  subtitle?: string;
  settings: SettingsCogView;
  empty?: { title: string; hint: string };
  projects: readonly InvoiceProjectRowView[];
  paging?: PagingView;
  footer: FooterView;
}

export function toInvoiceHomeView(
  workspace: InvoiceWorkspace,
  page = 0,
): InvoiceHomeView {
  const projectPage = getCardPage(
    workspace.items,
    page,
    INVOICE_PROJECT_PAGE_SIZE,
    'Invoice project page is no longer available.',
  );
  const count = workspace.items.length;
  const view: InvoiceHomeView = {
    title: 'Invoice',
    settings: toSettings(workspace.documentId),
    projects: projectPage.items.map((item) => toProject(item, workspace)),
    footer: toFooter(workspace.documentId),
  };
  if (count === 1) {
    view.subtitle = '1 project';
  } else if (count > 1) {
    view.subtitle = `${count} projects`;
  }
  if (count === 0) {
    view.empty = {
      title: 'No valid project blocks found in this Invoice.',
      hint: 'Open Invoice and check its project rows.',
    };
  }
  const paging = toPagingView(page, projectPage.pageCount, (targetPage) => ({
    functionName: CHANGE_INVOICE_PAGE_ACTION,
    parameters: {
      [INVOICE_DOCUMENT_ID_PARAMETER]: workspace.documentId,
      [INVOICE_PAGE_PARAMETER]: String(targetPage),
    },
    spinner: true,
  }));
  if (paging) {
    view.paging = paging;
  }
  return view;
}

function wordLine(label: string, value: number | undefined): string {
  return value === undefined ? `${label}: not set` : `${label}: ${value} words`;
}

function toSettings(documentId: string) {
  return toSettingsCogView({
    functionName: INVOICE_SETTINGS_ACTIONS.open,
    parameters: { [INVOICE_DOCUMENT_ID_PARAMETER]: documentId },
  });
}

function toFooter(documentId: string): FooterView {
  return {
    primary: openInvoiceFooterButton(documentId),
    secondary: {
      label: 'Finalize',
      altText: 'Calculate and write invoice costs using saved rates',
      action: {
        functionName: FINALIZE_INVOICE_ACTION,
        parameters: { [INVOICE_DOCUMENT_ID_PARAMETER]: documentId },
        spinner: true,
      },
    },
  };
}

function toProject(
  item: InvoiceWorkspaceItem,
  workspace: InvoiceWorkspace,
): InvoiceProjectRowView {
  const row: InvoiceProjectRowView = {
    topLabel: String(item.number),
    title: item.title,
    wordLines: [
      wordLine('Translation', item.translationWords),
      wordLine('Voice Over', item.voiceOverWords),
    ],
  };
  const folderProblem = describeInvoiceWorkspaceItemFolder(item);
  if (folderProblem) {
    row.folderProblem = folderProblem;
    row.recovery =
      item.folder.status === 'missing'
        ? 'Check its name and location.'
        : 'Keep one matching project folder.';
  }
  if (item.folder.status === 'matched') {
    row.parseOriginal = parseButton(workspace, item, 'original');
    row.parseTranslated = parseButton(workspace, item, 'translated');
  }
  return row;
}

function parseButton(
  workspace: InvoiceWorkspace,
  item: InvoiceWorkspaceItem,
  collection: InvoiceScriptCollection,
): InvoiceParseButtonView {
  if (item.folder.status !== 'matched') {
    throw new Error('Cannot build a parse action without one project folder.');
  }
  const original = collection === 'original';
  return {
    label: original ? 'Original' : 'Translated',
    altText: original
      ? `Parse original scripts for project ${item.number}: ${item.title}`
      : `Parse translated scripts for project ${item.number}: ${item.title}`,
    action: {
      functionName: OPEN_INVOICE_PROJECT_SCRIPTS_ACTION,
      parameters: {
        [INVOICE_DOCUMENT_ID_PARAMETER]: workspace.documentId,
        [PROJECT_FOLDER_ID_PARAMETER]: item.folder.folder.id,
        [PROJECT_NUMBER_PARAMETER]: String(item.number),
        [PROJECT_TITLE_PARAMETER]: item.title,
        [SCRIPT_COLLECTION_PARAMETER]: collection,
      },
      spinner: true,
    },
  };
}
