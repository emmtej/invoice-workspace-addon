export const OVERVIEW_SETTINGS_ACTIONS = {
  openSettings: 'onOpenOverviewSettings',
  toggle: 'onToggleAdditionalCharacterCheck',
  openEditor: 'onOpenAdditionalCharactersEditor',
  save: 'onSaveAdditionalCharacters',
  openClearPropertiesConfirmation:
    'onOpenClearProjectScriptPropertiesConfirmation',
  cancelClearProperties: 'onCancelClearProjectScriptProperties',
  clearProperties: 'onClearProjectScriptProperties',
} as const;

export const OVERVIEW_SETTINGS_PARAMETERS = {
  documentId: 'overviewDocumentId',
} as const;

export const OVERVIEW_SETTINGS_FIELDS = {
  enabled: 'additionalCharacterCheck.enabled',
  characters: 'additionalCharacterCheck.characters',
} as const;

export function overviewDocumentAction(
  functionName: string,
  overviewDocumentId: string,
  spinner = false,
): {
  functionName: string;
  parameters: Record<string, string>;
  spinner?: true;
} {
  return {
    functionName,
    parameters: {
      [OVERVIEW_SETTINGS_PARAMETERS.documentId]: overviewDocumentId,
    },
    ...(spinner ? { spinner: true as const } : {}),
  };
}
