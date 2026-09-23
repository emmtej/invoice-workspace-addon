import type { ErrorCardView } from '../../../ui/models';

export function toOverviewErrorView(
  message: string,
  host: 'docs' | 'drive',
): ErrorCardView {
  return {
    title: 'Overview Workspace',
    subtitle: 'Could not load',
    message,
    recovery:
      host === 'docs'
        ? 'To retry, reload this browser tab.'
        : 'To retry in Drive, select another file, then Overview.',
  };
}
