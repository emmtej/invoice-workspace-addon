export const INVOICE_DOCUMENT_NAME = 'Invoice';
export const GOOGLE_DOCS_MIME_TYPE = 'application/vnd.google-apps.document';
export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const GOOGLE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
export const ORIGINAL_SCRIPTS_FOLDER_NAME = 'Original Scripts';
export const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface NumberedProjectName {
  number: number;
  title: string;
}

export function getProjectFolderName(project: NumberedProjectName): string {
  return `${project.number} ${project.title}`;
}

export function parseNumberedProjectName(
  name: string,
): NumberedProjectName | undefined {
  const match = /^(\d+) (.+)$/.exec(name);
  if (!match) {
    return undefined;
  }
  const number = Number(match[1]);
  if (!Number.isSafeInteger(number)) {
    return undefined;
  }
  const title = match[2].trim();
  if (title.length === 0) {
    return undefined;
  }
  return { number, title };
}
