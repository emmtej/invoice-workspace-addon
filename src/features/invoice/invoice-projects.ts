import type {
  SourceFileRecord,
  WorkspaceFolderRecord,
} from '../../shared/drive-records';
import { getProjectFolderName } from '../../shared/workspace-domain';
import { normalizeTextNewlines } from '../../shared/text';

const PROJECT_HEADER_PATTERN = /^(\d+)\s+(.+)$/;
const ROW_SEPARATOR_PATTERN = /\s+-\s+/;

export type InvoiceScriptCollection = 'original' | 'translated';

export interface InvoiceProjectItem {
  number: number;
  title: string;
  translationWords?: number;
  voiceOverWords?: number;
}

export interface InvoiceProjectBlock {
  item: InvoiceProjectItem;
  headerLineIndex: number;
  translationLineIndex: number;
  voiceOverLineIndex: number;
  costLineIndex: number;
  translationRow: InvoiceBillingRow;
  voiceOverRow: InvoiceBillingRow;
}

export interface InvoiceProjectHeader {
  item: Pick<InvoiceProjectItem, 'number' | 'title'>;
  lineIndex: number;
}

export type InvoiceBillingLabel = 'Translation' | 'Voice Over';

export interface InvoiceBillingRow {
  label: InvoiceBillingLabel;
  line: string;
  wordValue: string;
  wordCount?: number;
  costExpression: string;
  wordValuePrefix: string;
  wordValueSuffix: string;
}

export interface InvoiceWordCountReplacement {
  lineIndex: number;
  previousLine: string;
  replacementLine: string;
}

export type InvoiceProjectFolderState =
  | { status: 'matched'; folder: WorkspaceFolderRecord }
  | { status: 'missing' }
  | {
      status: 'ambiguous';
      folders: WorkspaceFolderRecord[];
    };

export interface InvoiceWorkspaceItem extends InvoiceProjectItem {
  folder: InvoiceProjectFolderState;
}

export interface InvoiceProjectScriptList {
  collection: InvoiceScriptCollection;
  project: InvoiceProjectItem;
  expectedInvoiceWordCountLine: string;
  files: SourceFileRecord[];
}

function nextNonBlankLine(
  lines: readonly string[],
  start: number,
): { index: number; line: string } | undefined {
  for (let index = start; index < lines.length; index++) {
    const line = lines[index].trim();
    if (line) {
      return { index, line };
    }
  }
  return undefined;
}

function expectedWordPlaceholder(
  projectNumber: number,
  label: InvoiceBillingLabel,
): string {
  const field =
    label === 'Translation' ? 'TRANSLATION_WORDS' : 'VOICE_OVER_WORDS';
  return `{{PROJECT_${projectNumber}_${field}}}`;
}

function parseInvoiceProjectHeader(
  line: string,
): Pick<InvoiceProjectItem, 'number' | 'title'> | undefined {
  const header = line.trim().match(PROJECT_HEADER_PATTERN);
  if (!header) {
    return undefined;
  }

  const number = Number(header[1]);
  const title = header[2].trim();
  return Number.isSafeInteger(number) && title ? { number, title } : undefined;
}

export function findInvoiceProjectHeaders(
  text: string,
): InvoiceProjectHeader[] {
  return normalizeTextNewlines(text)
    .split('\n')
    .flatMap((line, lineIndex) => {
      const item = parseInvoiceProjectHeader(line);
      return item ? [{ item, lineIndex }] : [];
    });
}

export function parseInvoiceBillingRow(
  line: string,
  label: InvoiceBillingLabel,
  projectNumber: number,
): InvoiceBillingRow | undefined {
  const match = line.match(
    new RegExp(`^(${label}\\s+-\\s+)(\\S+)(\\s+-\\s+)(\\S(?:.*\\S)?)$`),
  );
  if (!match) {
    return undefined;
  }

  const wordValue = match[2];
  const costExpression = match[4];
  if (ROW_SEPARATOR_PATTERN.test(costExpression)) {
    return undefined;
  }

  let wordCount: number | undefined;
  if (/^\d+$/.test(wordValue)) {
    const value = Number(wordValue);
    if (!Number.isSafeInteger(value)) {
      return undefined;
    }
    wordCount = value;
  } else if (wordValue !== expectedWordPlaceholder(projectNumber, label)) {
    return undefined;
  }

  return {
    label,
    line,
    wordValue,
    ...(wordCount === undefined ? {} : { wordCount }),
    costExpression,
    wordValuePrefix: match[1],
    wordValueSuffix: `${match[3]}${costExpression}`,
  };
}

function parseInvoiceCostRow(line: string): string | undefined {
  const match = line.match(/^Cost\s+-\s+(\S(?:.*\S)?)$/);
  if (!match || ROW_SEPARATOR_PATTERN.test(match[1])) {
    return undefined;
  }
  return match[1];
}

export function parseInvoiceProjectBlocks(text: string): InvoiceProjectBlock[] {
  const lines = normalizeTextNewlines(text).split('\n');
  const blocks: InvoiceProjectBlock[] = [];
  const seenFolderNames = new Set<string>();

  for (let index = 0; index < lines.length; index++) {
    const item = parseInvoiceProjectHeader(lines[index]);
    if (!item) {
      continue;
    }

    const { number } = item;

    const translation = nextNonBlankLine(lines, index + 1);
    const voiceOver = translation
      ? nextNonBlankLine(lines, translation.index + 1)
      : undefined;
    const cost = voiceOver
      ? nextNonBlankLine(lines, voiceOver.index + 1)
      : undefined;
    if (!translation || !voiceOver || !cost) {
      continue;
    }

    const translationRow = parseInvoiceBillingRow(
      translation.line,
      'Translation',
      number,
    );
    const voiceOverRow = parseInvoiceBillingRow(
      voiceOver.line,
      'Voice Over',
      number,
    );
    if (
      !translationRow ||
      !voiceOverRow ||
      parseInvoiceCostRow(cost.line) === undefined
    ) {
      continue;
    }

    const projectItem: InvoiceProjectItem = { ...item };
    if (translationRow.wordCount !== undefined) {
      projectItem.translationWords = translationRow.wordCount;
    }
    if (voiceOverRow.wordCount !== undefined) {
      projectItem.voiceOverWords = voiceOverRow.wordCount;
    }
    const folderName = getProjectFolderName(projectItem);
    if (seenFolderNames.has(folderName)) {
      throw new Error(`Invoice has duplicate project item "${folderName}".`);
    }
    seenFolderNames.add(folderName);
    blocks.push({
      item: projectItem,
      headerLineIndex: index,
      translationLineIndex: translation.index,
      voiceOverLineIndex: voiceOver.index,
      costLineIndex: cost.index,
      translationRow,
      voiceOverRow,
    });
    index = cost.index;
  }

  return blocks;
}

export function parseInvoiceProjectItems(text: string): InvoiceProjectItem[] {
  return parseInvoiceProjectBlocks(text).map((block) => block.item);
}

export function createInvoiceWordCountReplacement(
  text: string,
  project: Pick<InvoiceProjectItem, 'number' | 'title'>,
  collection: InvoiceScriptCollection,
  wordCount: number,
): InvoiceWordCountReplacement {
  if (!Number.isSafeInteger(wordCount) || wordCount < 0) {
    throw new Error('Invoice word count must be a non-negative integer.');
  }

  const blocks = parseInvoiceProjectBlocks(text).filter(
    (block) =>
      block.item.number === project.number &&
      block.item.title === project.title,
  );
  if (blocks.length !== 1) {
    throw new Error(
      'Invoice project item is missing or ambiguous. Reload the Invoice card.',
    );
  }

  const block = blocks[0];
  const lineIndex =
    collection === 'original'
      ? block.translationLineIndex
      : block.voiceOverLineIndex;
  const row =
    collection === 'original' ? block.translationRow : block.voiceOverRow;

  return {
    lineIndex,
    previousLine: row.line,
    replacementLine: `${row.wordValuePrefix}${wordCount}${row.wordValueSuffix}`,
  };
}

export function getInvoiceWordCountLine(
  text: string,
  project: Pick<InvoiceProjectItem, 'number' | 'title'>,
  collection: InvoiceScriptCollection,
): string {
  return createInvoiceWordCountReplacement(text, project, collection, 0)
    .previousLine;
}

export function matchInvoiceProjectFolders(
  items: readonly InvoiceProjectItem[],
  folders: readonly WorkspaceFolderRecord[],
): InvoiceWorkspaceItem[] {
  return items.map((item) => {
    const expectedName = getProjectFolderName(item);
    const matches = folders.filter((folder) => folder.name === expectedName);
    if (matches.length === 0) {
      return { ...item, folder: { status: 'missing' } };
    }
    if (matches.length > 1) {
      return { ...item, folder: { status: 'ambiguous', folders: matches } };
    }
    return { ...item, folder: { status: 'matched', folder: matches[0] } };
  });
}

export function sortInvoiceProjectScripts(
  files: readonly SourceFileRecord[],
): SourceFileRecord[] {
  return [...files].sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  );
}
