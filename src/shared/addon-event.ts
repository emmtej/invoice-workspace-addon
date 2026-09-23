import { DRIVE_ID_PATTERN } from './workspace-domain';

export function readStringFormInput(
  event: GoogleAppsScript.Addons.EventObject,
  fieldName: string,
): string {
  const value =
    event.commonEventObject?.formInputs?.[fieldName]?.stringInputs?.value?.[0];
  return typeof value === 'string' ? value : '';
}

export function readDriveIdParameter(
  parameters: Record<string, string> | undefined,
  parameterName: string,
  errorMessage: string,
): string {
  const value = parameters?.[parameterName];
  if (!value || !DRIVE_ID_PATTERN.test(value)) {
    throw new Error(errorMessage);
  }
  return value;
}
