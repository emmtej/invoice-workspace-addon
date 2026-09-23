import {
  INVOICE_TOTAL_COST_PLACEHOLDER,
  projectInvoicePlaceholders,
} from '../../shared/invoice-placeholders';
import { normalizeTextNewlines } from '../../shared/text';
import {
  findInvoiceProjectHeaders,
  parseInvoiceProjectBlocks,
} from './invoice-projects';
import {
  INVOICE_CURRENCIES,
  normalizeInvoiceRate,
  type InvoiceCurrency,
  type InvoiceRateSettings,
} from './invoice-settings';

const RATE_SCALE = 1_000_000;
const RATE_UNITS_PER_CENT = 10_000;
const ROUND_HALF_UP_INCREMENT = RATE_UNITS_PER_CENT / 2;
const STORED_COST_PATTERN = /^(?:(?:USD|EUR) |\$|€)?\d+\.\d{2}$/;
const BILLING_ROW_PATTERN = /^(?:Translation|Voice Over|Cost)\s+-\s+/;
const CURRENCY_SYMBOLS: Record<InvoiceCurrency, string> = {
  USD: '$',
  EUR: '€',
};

export interface InvoiceLineReplacement {
  lineIndex: number;
  previousLine: string;
  replacementLine: string;
}

export interface FinalizedInvoiceProject {
  number: number;
  title: string;
  translationCost: string;
  voiceOverCost: string;
  totalCost: string;
}

export interface InvoiceFinalization {
  replacements: InvoiceLineReplacement[];
  projects: FinalizedInvoiceProject[];
  invoiceTotalCost: string;
}

function parseRateUnits(rate: string, label: string): number {
  const normalized = normalizeInvoiceRate(rate, label);
  const [whole, fraction = ''] = normalized.split('.');
  return Number(whole) * RATE_SCALE + Number(fraction.padEnd(6, '0'));
}

function calculateRoundedCents(
  wordCount: number,
  rateUnits: number,
  label: string,
): number {
  if (rateUnits === 0) {
    return 0;
  }
  const maximumWordCount = Math.floor(
    (Number.MAX_SAFE_INTEGER - ROUND_HALF_UP_INCREMENT) / rateUnits,
  );
  if (wordCount > maximumWordCount) {
    throw new Error(`${label} cost is too large to calculate safely.`);
  }
  return Math.floor(
    (wordCount * rateUnits + ROUND_HALF_UP_INCREMENT) / RATE_UNITS_PER_CENT,
  );
}

function addSafeCents(left: number, right: number): number {
  const total = left + right;
  if (!Number.isSafeInteger(total)) {
    throw new Error('Invoice total cost is too large to calculate safely.');
  }
  return total;
}

function formatCents(cents: number, currency: InvoiceCurrency): string {
  return `${CURRENCY_SYMBOLS[currency]}${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

function requireReplaceableCost(
  currentValue: string,
  expectedPlaceholder: string,
  label: string,
): void {
  if (
    currentValue !== expectedPlaceholder &&
    !STORED_COST_PATTERN.test(currentValue)
  ) {
    throw new Error(
      `${label} must contain its expected placeholder or a previously finalized cost.`,
    );
  }
}

function replaceTrailingValue(
  lineIndex: number,
  line: string,
  previousValue: string,
  nextValue: string,
): InvoiceLineReplacement {
  if (!line.endsWith(previousValue)) {
    throw new Error('Invoice cost row structure is invalid.');
  }
  return {
    lineIndex,
    previousLine: line,
    replacementLine: `${line.slice(0, -previousValue.length)}${nextValue}`,
  };
}

function parseProjectCostRow(
  line: string,
): { line: string; value: string } | undefined {
  const trimmed = line.trim();
  const match = trimmed.match(/^Cost\s+-\s+(\S(?:.*\S)?)$/);
  if (!match || /\s+-\s+/.test(match[1])) {
    return undefined;
  }
  return { line: trimmed, value: match[1] };
}

function findInvoiceTotalRow(lines: readonly string[]): {
  lineIndex: number;
  line: string;
  value: string;
} {
  const matches = lines.flatMap((rawLine, lineIndex) => {
    const line = rawLine.trim();
    const match = line.match(/^Total Cost\s+-\s+(\S(?:.*\S)?)$/);
    return match ? [{ lineIndex, line, value: match[1] }] : [];
  });
  if (matches.length !== 1) {
    throw new Error('Invoice must contain exactly one Total Cost row.');
  }
  return matches[0];
}

export function createInvoiceFinalization(
  text: string,
  settings: InvoiceRateSettings,
): InvoiceFinalization {
  if (!settings.translationRate || !settings.voiceOverRate) {
    throw new Error('Set both per-word rates in Invoice Settings first.');
  }
  if (!INVOICE_CURRENCIES.includes(settings.currency)) {
    throw new Error('Currency must be USD or EUR.');
  }
  const translationRateUnits = parseRateUnits(
    settings.translationRate,
    'Translation rate',
  );
  const voiceOverRateUnits = parseRateUnits(
    settings.voiceOverRate,
    'Voice Over rate',
  );
  const lines = normalizeTextNewlines(text).split('\n');
  const invoiceTotalRow = findInvoiceTotalRow(lines);
  const firstNonBlankLineIndex = lines.findIndex((line) => line.trim());
  const blocks = parseInvoiceProjectBlocks(text);
  const completeHeaderLineIndexes = new Set(
    blocks.map((block) => block.headerLineIndex),
  );
  const incompleteHeader = findInvoiceProjectHeaders(text).find(
    (header) =>
      header.lineIndex < invoiceTotalRow.lineIndex &&
      !(
        header.lineIndex === firstNonBlankLineIndex &&
        lines[header.lineIndex].trim().endsWith(' Voice Over Invoice')
      ) &&
      !completeHeaderLineIndexes.has(header.lineIndex),
  );
  if (incompleteHeader) {
    throw new Error(
      `Project ${incompleteHeader.item.number} has an incomplete or invalid billing block.`,
    );
  }
  if (blocks.length === 0) {
    throw new Error('Invoice has no complete project items to finalize.');
  }

  const ownedBillingLineIndexes = new Set<number>();
  const replacements: InvoiceLineReplacement[] = [];
  const projects: FinalizedInvoiceProject[] = [];
  let invoiceTotalCents = 0;

  for (const block of blocks) {
    const { item, translationRow, voiceOverRow } = block;
    if (
      item.translationWords === undefined ||
      item.voiceOverWords === undefined
    ) {
      throw new Error(
        `Project ${item.number} requires both Translation and Voice Over word counts before finalizing.`,
      );
    }

    const placeholders = projectInvoicePlaceholders(item.number);
    requireReplaceableCost(
      translationRow.costExpression,
      placeholders.translationCost,
      `Project ${item.number} Translation cost`,
    );
    requireReplaceableCost(
      voiceOverRow.costExpression,
      placeholders.voiceOverCost,
      `Project ${item.number} Voice Over cost`,
    );
    const projectCostRow = parseProjectCostRow(
      lines[block.costLineIndex] ?? '',
    );
    if (!projectCostRow) {
      throw new Error(`Project ${item.number} Cost row is invalid.`);
    }
    requireReplaceableCost(
      projectCostRow.value,
      placeholders.totalCost,
      `Project ${item.number} total cost`,
    );

    const translationCents = calculateRoundedCents(
      item.translationWords,
      translationRateUnits,
      `Project ${item.number} Translation`,
    );
    const voiceOverCents = calculateRoundedCents(
      item.voiceOverWords,
      voiceOverRateUnits,
      `Project ${item.number} Voice Over`,
    );
    const projectTotalCents = addSafeCents(translationCents, voiceOverCents);
    invoiceTotalCents = addSafeCents(invoiceTotalCents, projectTotalCents);

    const translationCost = formatCents(translationCents, settings.currency);
    const voiceOverCost = formatCents(voiceOverCents, settings.currency);
    const totalCost = formatCents(projectTotalCents, settings.currency);
    replacements.push(
      replaceTrailingValue(
        block.translationLineIndex,
        translationRow.line,
        translationRow.costExpression,
        translationCost,
      ),
      replaceTrailingValue(
        block.voiceOverLineIndex,
        voiceOverRow.line,
        voiceOverRow.costExpression,
        voiceOverCost,
      ),
      replaceTrailingValue(
        block.costLineIndex,
        projectCostRow.line,
        projectCostRow.value,
        totalCost,
      ),
    );
    ownedBillingLineIndexes.add(block.translationLineIndex);
    ownedBillingLineIndexes.add(block.voiceOverLineIndex);
    ownedBillingLineIndexes.add(block.costLineIndex);
    projects.push({
      number: item.number,
      title: item.title,
      translationCost,
      voiceOverCost,
      totalCost,
    });
  }

  lines.forEach((rawLine, lineIndex) => {
    if (
      BILLING_ROW_PATTERN.test(rawLine.trim()) &&
      !ownedBillingLineIndexes.has(lineIndex)
    ) {
      throw new Error('Invoice contains an unrecognized project billing row.');
    }
  });

  requireReplaceableCost(
    invoiceTotalRow.value,
    INVOICE_TOTAL_COST_PLACEHOLDER,
    'Invoice total cost',
  );
  const invoiceTotalCost = formatCents(invoiceTotalCents, settings.currency);
  replacements.push(
    replaceTrailingValue(
      invoiceTotalRow.lineIndex,
      invoiceTotalRow.line,
      invoiceTotalRow.value,
      invoiceTotalCost,
    ),
  );

  return { replacements, projects, invoiceTotalCost };
}
