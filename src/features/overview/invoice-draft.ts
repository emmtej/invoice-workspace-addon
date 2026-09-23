import {
  INVOICE_TOTAL_COST_PLACEHOLDER,
  PAYONEER_EMAIL_PLACEHOLDER,
  projectInvoicePlaceholders,
} from '../../shared/invoice-placeholders';

export interface InvoiceDraftProject {
  number: number;
  title: string;
  voiceActor?: string;
}

export function getInvoiceVoiceActor(
  projects: readonly InvoiceDraftProject[],
): string {
  return (projects[0]?.voiceActor ?? '').trim();
}

export function getInvoiceDraftValidationError(
  projects: readonly InvoiceDraftProject[],
): string | undefined {
  if (projects.length === 0) {
    return 'Overview has no project items.';
  }
  if (getInvoiceVoiceActor(projects).length === 0) {
    return 'Overview is missing a voice actor.';
  }
  const numbers = projects.map((project) => project.number);
  if (new Set(numbers).size !== numbers.length) {
    return 'Overview has duplicate project numbers.';
  }
  return undefined;
}

export function renderInvoiceDraft(options: {
  voiceActor: string;
  todayText: string;
  projects: readonly InvoiceDraftProject[];
}): string {
  const actor = options.voiceActor.trim();
  const title = [actor, 'Italian Voice Over Invoice']
    .filter((part) => part.length > 0)
    .join(' ');
  const blocks = options.projects.map((project) => {
    const placeholders = projectInvoicePlaceholders(project.number);
    return [
      `${project.number} ${project.title}`,
      `Translation - ${placeholders.translationWords} - ${placeholders.translationCost}`,
      `Voice Over - ${placeholders.voiceOverWords} - ${placeholders.voiceOverCost}`,
      `Cost - ${placeholders.totalCost}`,
    ].join('\n');
  });

  return [
    title,
    options.todayText,
    '',
    ...blocks.flatMap((block, index) => (index === 0 ? [block] : ['', block])),
    '',
    `Total Cost - ${INVOICE_TOTAL_COST_PLACEHOLDER}`,
    `Payoneer - ${PAYONEER_EMAIL_PLACEHOLDER}`,
  ].join('\n');
}
