import type { CardActionSpec } from '../../../ui/models';

export interface DocsAccessView {
  title: string;
  subtitle: string;
  body: string;
  grantLabel: string;
  grantAltText: string;
  grantAction: CardActionSpec;
  afterClick: string;
}

export function toDocsAccessView(): DocsAccessView {
  return {
    title: 'Overview Workspace',
    subtitle: 'Permission needed',
    body: 'This add-on needs access to the open Overview document to read project items.',
    grantLabel: 'Grant access',
    grantAltText: 'Grant access to this Overview document',
    grantAction: {
      functionName: 'onRequestDocsFileScope',
      parameters: {},
    },
    afterClick:
      'Google will prompt once. The workspace card appears after you allow it.',
  };
}
