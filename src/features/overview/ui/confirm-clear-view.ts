import type { FooterView } from '../../../ui/models';
import {
  OVERVIEW_SETTINGS_ACTIONS,
  overviewDocumentAction,
} from '../overview-settings-action-ids';

export interface ConfirmClearView {
  title: string;
  subtitle: string;
  paragraphs: readonly string[];
  footer: FooterView;
}

export function toConfirmClearView(
  overviewDocumentId: string,
): ConfirmClearView {
  return {
    title: 'Confirm metadata removal',
    subtitle: 'Cannot be undone',
    paragraphs: [
      "Clear Invoice Workspace properties from Original Scripts in this Overview's projects?",
      'Files stay in Drive. Renamed scripts may stop matching their characters.',
    ],
    footer: {
      primary: {
        label: 'Clear properties',
        altText:
          "Confirm clearing Invoice Workspace app properties from this Overview's project scripts",
        style: 'danger',
        action: overviewDocumentAction(
          OVERVIEW_SETTINGS_ACTIONS.clearProperties,
          overviewDocumentId,
          true,
        ),
      },
      secondary: {
        label: 'Cancel',
        altText: 'Cancel metadata removal and return to Overview settings',
        action: overviewDocumentAction(
          OVERVIEW_SETTINGS_ACTIONS.cancelClearProperties,
          overviewDocumentId,
        ),
      },
    },
  };
}
