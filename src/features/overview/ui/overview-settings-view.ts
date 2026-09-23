import type { CardActionSpec } from '../../../ui/models';
import {
  OVERVIEW_SETTINGS_ACTIONS,
  OVERVIEW_SETTINGS_FIELDS,
  overviewDocumentAction,
} from '../overview-settings-action-ids';
import type { AdditionalCharacterCheckSettings } from '../overview-settings';

export interface OverviewSettingsView {
  title: string;
  extraHeader: string;
  scopeHint: string;
  toggleLabel: string;
  toggleFieldName: string;
  toggleValue: string;
  toggleSelected: boolean;
  toggleAction: CardActionSpec;
  namesLabel: string;
  namesLine: string;
  editLabel: string;
  editAltText: string;
  editAction: CardActionSpec;
  metadataHeader: string;
  metadataBody: string;
  clearLabel: string;
  clearAltText: string;
  clearAction: CardActionSpec;
}

export function toOverviewSettingsView(
  settings: AdditionalCharacterCheckSettings,
  overviewDocumentId: string,
): OverviewSettingsView {
  const hasNames = settings.characters.length > 0;
  return {
    title: 'Overview settings',
    extraHeader: 'Extra characters',
    scopeHint: 'Across your Overviews',
    toggleLabel: 'Include during setup',
    toggleFieldName: OVERVIEW_SETTINGS_FIELDS.enabled,
    toggleValue: 'true',
    toggleSelected: settings.enabled,
    toggleAction: overviewDocumentAction(
      OVERVIEW_SETTINGS_ACTIONS.toggle,
      overviewDocumentId,
    ),
    namesLabel:
      !settings.enabled && hasNames ? 'Saved names · Inactive' : 'Saved names',
    namesLine: hasNames
      ? settings.characters.join(', ')
      : 'No names saved. Choose Edit.',
    editLabel: 'Edit',
    editAltText: 'Edit additional character names',
    editAction: overviewDocumentAction(
      OVERVIEW_SETTINGS_ACTIONS.openEditor,
      overviewDocumentId,
    ),
    metadataHeader: 'Script file metadata',
    metadataBody: "This Overview's project scripts.",
    clearLabel: 'Review cleanup',
    clearAltText:
      "Review removal of Invoice Workspace app properties from this Overview's project scripts",
    clearAction: overviewDocumentAction(
      OVERVIEW_SETTINGS_ACTIONS.openClearPropertiesConfirmation,
      overviewDocumentId,
    ),
  };
}
