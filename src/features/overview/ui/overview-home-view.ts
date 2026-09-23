import type {
  CardActionSpec,
  FooterView,
  SettingsCogView,
} from '../../../ui/models';
import { toSettingsCogView } from '../../../ui/settings-cog';
import { parseDriveFolderId } from '../character-scripts';
import {
  CREATE_INVOICE_ACTION,
  CREATE_INVOICE_DOCUMENT_PARAMETER,
  getInvoiceCardPresentation,
} from '../invoice-card';
import type { OverviewWorkspace, WorkspaceProjectItem } from '../model';
import {
  OVERVIEW_SETTINGS_ACTIONS,
  OVERVIEW_SETTINGS_PARAMETERS,
} from '../overview-settings-action-ids';
import { getWorkspaceIssueSummary } from '../workspace-reasons';

const NO_SOURCE_HINT = 'Add a valid character-scripts folder link.';
const MISSING_LINK_ACTION: CardActionSpec = {
  functionName: 'onMissingProjectLink',
  parameters: {},
};

export type OverviewLinkView =
  | { label: string; altText: string; openUrl: string }
  | { label: string; altText: string; action: CardActionSpec };

export interface OverviewStatusView {
  text: string;
  bottomLabel?: string;
  icon?: 'clock' | 'error';
  iconAltText?: string;
  actionLabel?: string;
  actionAltText?: string;
  action?: CardActionSpec;
}

export interface OverviewProjectView {
  topLabel: string;
  characters: string;
  links: readonly OverviewLinkView[];
  status?: OverviewStatusView;
}

export interface OverviewHomeView {
  title: string;
  subtitle?: string;
  settings: SettingsCogView;
  invoiceWarning?: { header: string; text: string };
  empty?: { title: string; hint: string };
  projects: readonly OverviewProjectView[];
  footer?: FooterView;
}

export function toOverviewHomeView(
  workspace: OverviewWorkspace,
): OverviewHomeView {
  const count = workspace.items.length;
  const invoice = workspace.invoice
    ? getInvoiceCardPresentation(workspace.invoice, workspace.items)
    : {};
  return {
    title: 'Overview Workspace',
    subtitle:
      count === 0 ? undefined : count === 1 ? '1 project' : `${count} projects`,
    settings: toSettings(workspace.documentId),
    invoiceWarning: invoice.warning
      ? { header: 'Invoice', text: invoice.warning }
      : undefined,
    empty:
      count === 0
        ? {
            title: 'No project items found in this Overview.',
            hint: 'Add numbered project blocks to the document, then reload.',
          }
        : undefined,
    projects: workspace.items.map((item) =>
      toProject(item, workspace.documentId),
    ),
    footer: toFooter(invoice.footer, workspace.documentId),
  };
}

function toSettings(documentId: string) {
  return toSettingsCogView({
    functionName: OVERVIEW_SETTINGS_ACTIONS.openSettings,
    parameters: { [OVERVIEW_SETTINGS_PARAMETERS.documentId]: documentId },
  });
}

function toProject(
  item: WorkspaceProjectItem,
  documentId: string,
): OverviewProjectView {
  return {
    topLabel: `${item.number} ${item.title}`,
    characters:
      item.characters.length === 0
        ? 'No characters listed.'
        : item.characters.join(', '),
    links: [
      toLink(
        'Scripts',
        'Open character scripts folder',
        'No character scripts folder link',
        item.characterScriptsFolderUrl,
      ),
      toLink(
        'Source Video',
        'Open source video folder',
        'No source video folder link',
        item.postProductionFolderUrl,
      ),
      toLink('YouTube', 'Open YouTube', 'No YouTube link', item.youtubeUrl),
    ],
    status: toStatus(item, documentId),
  };
}

function toLink(
  label: string,
  presentAlt: string,
  missingAlt: string,
  url: string | undefined,
): OverviewLinkView {
  if (url) {
    return { label, altText: presentAlt, openUrl: url };
  }
  return { label, altText: missingAlt, action: MISSING_LINK_ACTION };
}

function toStatus(
  item: WorkspaceProjectItem,
  documentId: string,
): OverviewStatusView | undefined {
  if (item.workspace.initialized) {
    return undefined;
  }

  const hasSource = Boolean(parseDriveFolderId(item.characterScriptsFolderUrl));
  const issueSummary = getWorkspaceIssueSummary(item.workspace.issues);
  const initialize = hasSource
    ? toInitializeAction(item, documentId)
    : undefined;

  switch (item.workspace.status) {
    case 'missing':
      return {
        text: 'Not set up',
        icon: 'error',
        iconAltText: 'Not set up',
        bottomLabel: hasSource ? undefined : NO_SOURCE_HINT,
        ...initialize,
      };
    case 'partial':
      return {
        text: 'Setup incomplete',
        icon: 'clock',
        iconAltText: 'Setup incomplete',
        bottomLabel: joinBottom(
          issueSummary,
          hasSource ? undefined : NO_SOURCE_HINT,
        ),
        ...initialize,
      };
    case 'ambiguous':
      return {
        text: 'Several matching folders',
        bottomLabel: issueSummary,
      };
    case 'unknown':
      return {
        text: 'Status unavailable',
        bottomLabel: issueSummary,
      };
    default:
      return undefined;
  }
}

function toInitializeAction(
  item: WorkspaceProjectItem,
  documentId: string,
): Pick<OverviewStatusView, 'actionLabel' | 'actionAltText' | 'action'> {
  const resume = item.workspace.status === 'partial';
  return {
    actionLabel: resume ? 'Resume' : 'Initialize',
    actionAltText: resume
      ? `Resume initialization for project ${item.number}`
      : `Initialize project ${item.number}`,
    action: {
      functionName: 'onInitializeProject',
      parameters: {
        overviewDocumentId: documentId,
        projectNumber: String(item.number),
        expectedTitle: item.title,
      },
      spinner: true,
    },
  };
}

function joinBottom(...parts: Array<string | undefined>): string | undefined {
  const joined = parts.filter(Boolean).join(' · ');
  return joined || undefined;
}

function toFooter(
  footer: ReturnType<typeof getInvoiceCardPresentation>['footer'],
  documentId: string,
): FooterView | undefined {
  if (!footer) {
    return undefined;
  }
  if (footer.kind === 'create') {
    return {
      primary: {
        label: 'Create Invoice',
        style: 'filled',
        action: {
          functionName: CREATE_INVOICE_ACTION,
          parameters: { [CREATE_INVOICE_DOCUMENT_PARAMETER]: documentId },
          spinner: true,
        },
      },
    };
  }
  return {
    primary: {
      label: 'Open Invoice',
      style: 'filled',
      openLink: { url: footer.url, openAs: 'full-size' },
    },
  };
}
