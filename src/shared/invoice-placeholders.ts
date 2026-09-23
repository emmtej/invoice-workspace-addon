export const INVOICE_TOTAL_COST_PLACEHOLDER = '{{INVOICE_TOTAL_COST}}';
export const PAYONEER_EMAIL_PLACEHOLDER = '{{PAYONEER_EMAIL}}';

export function projectInvoicePlaceholders(projectNumber: number): {
  translationWords: string;
  translationCost: string;
  voiceOverWords: string;
  voiceOverCost: string;
  totalCost: string;
} {
  const token = (field: string): string =>
    `{{PROJECT_${projectNumber}_${field}}}`;
  return {
    translationWords: token('TRANSLATION_WORDS'),
    translationCost: token('TRANSLATION_COST'),
    voiceOverWords: token('VOICE_OVER_WORDS'),
    voiceOverCost: token('VOICE_OVER_COST'),
    totalCost: token('TOTAL_COST'),
  };
}
