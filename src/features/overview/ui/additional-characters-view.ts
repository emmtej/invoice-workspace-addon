import type { FooterView } from '../../../ui/models';
import {
  OVERVIEW_SETTINGS_ACTIONS,
  OVERVIEW_SETTINGS_FIELDS,
  OVERVIEW_SETTINGS_PARAMETERS,
} from '../overview-settings-action-ids';

export interface AdditionalCharactersView {
  title: string;
  subtitle: string;
  fieldName: string;
  fieldTitle: string;
  hint: string;
  value: string;
  footer: FooterView;
}

export function toAdditionalCharactersView(
  characters: readonly string[],
  overviewDocumentId: string,
): AdditionalCharactersView {
  return {
    title: 'Additional characters',
    subtitle: 'Used when the check is on',
    fieldName: OVERVIEW_SETTINGS_FIELDS.characters,
    fieldTitle: 'Names (comma-separated)',
    hint: 'Leave blank to clear.',
    value: characters.join(', '),
    footer: {
      primary: {
        label: 'Save',
        altText: 'Save additional character names',
        style: 'filled',
        action: {
          functionName: OVERVIEW_SETTINGS_ACTIONS.save,
          parameters: {
            [OVERVIEW_SETTINGS_PARAMETERS.documentId]: overviewDocumentId,
          },
        },
      },
    },
  };
}
