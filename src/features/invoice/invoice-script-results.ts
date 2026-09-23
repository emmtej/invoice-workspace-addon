import type { ActionProcessBudget } from '../../shared/action-process-budget';
import type { SourceFileRecord } from '../../shared/drive-records';
import {
  calculateBillableWordsFromParsedScript,
  countBillableWords,
} from './billable-words';
import type { InvoiceProjectScriptList } from './invoice-projects';
import type { InvoiceProjectScriptsRequest } from './invoice-workspace';
import type { ScriptContentUnavailableReason } from './script-content';
import {
  parseScriptText,
  type ParsedScript,
  type ScriptLineKind,
} from './script-parsing';
import { createInvoiceParsingSignatureBuilder } from './invoice-parsing-signature';

export interface InvoiceInvalidLine {
  lineNumber: number;
  text: string;
  kind: ScriptLineKind;
}

export interface InvoiceParsedScriptResult {
  status: 'ready';
  file: SourceFileRecord;
  billableWords: number;
  invalidLines: InvoiceInvalidLine[];
}

export interface InvoiceUnavailableScriptResult {
  status: 'unavailable';
  file: SourceFileRecord;
  reason: ScriptContentUnavailableReason | 'time-limit';
}

export type InvoiceScriptResult =
  | InvoiceParsedScriptResult
  | InvoiceUnavailableScriptResult;

export interface InvoiceProjectScriptParsingResult {
  request: InvoiceProjectScriptsRequest;
  project: InvoiceProjectScriptList['project'];
  scripts: InvoiceScriptResult[];
  totalBillableWords?: number;
  parsingSignature: string;
  canApply: boolean;
}

export interface InvoiceScriptLineAuditRow {
  lineNumber: number;
  lineType: ScriptLineKind;
  line: string;
  billedWords?: number;
  needsReview: boolean;
}

export interface InvoiceScriptLineAuditResult {
  request: InvoiceProjectScriptsRequest;
  project: InvoiceProjectScriptList['project'];
  file: SourceFileRecord;
  rows: InvoiceScriptLineAuditRow[];
  totalBillableWords: number;
}

export type InvoiceScriptContentReader = (file: SourceFileRecord) =>
  | { status: 'ready'; text: string }
  | {
      status: 'unavailable';
      reason: ScriptContentUnavailableReason;
      detail?: string;
    };

const PARSING_RESERVE_MS = 2_000;

export function buildInvoiceScriptLineAuditRows(
  parsed: ParsedScript,
): InvoiceScriptLineAuditRow[] {
  const reviewLines = new Set(
    collectInvoiceInvalidLines(parsed).map((line) => line.lineNumber),
  );
  return parsed.lines.map((line) => ({
    lineNumber: line.lineIndex + 1,
    lineType: line.kind,
    line: line.raw,
    needsReview: reviewLines.has(line.lineIndex + 1),
    ...(line.kind === 'dialogue'
      ? { billedWords: countBillableWords(line.spokenText) }
      : {}),
  }));
}

export function parseInvoiceScriptLineAudit(
  request: InvoiceProjectScriptsRequest,
  list: InvoiceProjectScriptList,
  scriptFileId: string,
  readContent: InvoiceScriptContentReader,
): InvoiceScriptLineAuditResult {
  const matches = list.files.filter((file) => file.id === scriptFileId);
  if (matches.length !== 1) {
    throw new Error('Script is missing or ambiguous. Parse scripts again.');
  }

  const file = matches[0];
  let content: ReturnType<InvoiceScriptContentReader>;
  try {
    content = readContent(file);
  } catch (_error) {
    throw new Error('Script could not be read.');
  }
  if (content.status !== 'ready') {
    throw new Error(`Script could not be read (${content.reason}).`);
  }

  const parsed = parseScriptText(content.text);
  return {
    request,
    project: list.project,
    file,
    rows: buildInvoiceScriptLineAuditRows(parsed),
    totalBillableWords: calculateBillableWordsFromParsedScript(parsed),
  };
}

export function collectInvoiceInvalidLines(
  parsed: ParsedScript,
): InvoiceInvalidLine[] {
  const indexes = new Set<number>();
  for (const warning of parsed.warnings) {
    if (warning.code === 'invalid-speaker') {
      indexes.add(warning.lineIndex);
    } else {
      for (const lineIndex of warning.metadataLineIndexes) {
        indexes.add(lineIndex);
      }
    }
  }

  return [...indexes]
    .sort((left, right) => left - right)
    .map((lineIndex) => ({
      lineNumber: lineIndex + 1,
      text: parsed.lines[lineIndex]?.raw ?? '',
      kind: parsed.lines[lineIndex]?.kind ?? 'metadata',
    }));
}

export function parseInvoiceProjectScriptCollection(
  request: InvoiceProjectScriptsRequest,
  list: InvoiceProjectScriptList,
  readContent: InvoiceScriptContentReader,
  budget?: ActionProcessBudget,
): InvoiceProjectScriptParsingResult {
  const signature = createInvoiceParsingSignatureBuilder();
  [
    request.invoiceDocumentId,
    request.projectFolderId,
    String(request.projectNumber),
    request.projectTitle,
    request.collection,
  ].forEach((value) => signature.add(value));

  const scripts: InvoiceScriptResult[] = [];
  let totalBillableWords = 0;
  let canApply = list.files.length > 0;

  for (const file of list.files) {
    [file.id, file.name, file.mimeType, file.size ?? ''].forEach((value) =>
      signature.add(value),
    );

    if (budget && !budget.canContinue(PARSING_RESERVE_MS)) {
      signature.add('time-limit');
      scripts.push({ status: 'unavailable', file, reason: 'time-limit' });
      canApply = false;
      continue;
    }

    let content: ReturnType<InvoiceScriptContentReader>;
    try {
      content = readContent(file);
    } catch (_error) {
      content = { status: 'unavailable', reason: 'read-failed' };
    }
    if (content.status !== 'ready') {
      signature.add(content.reason);
      scripts.push({
        status: 'unavailable',
        file,
        reason: content.reason,
      });
      canApply = false;
      continue;
    }

    signature.add(content.text);
    const parsed = parseScriptText(content.text);
    const billableWords = calculateBillableWordsFromParsedScript(parsed);
    const invalidLines = collectInvoiceInvalidLines(parsed);
    scripts.push({
      status: 'ready',
      file,
      billableWords,
      invalidLines,
    });
    totalBillableWords += billableWords;
  }

  return {
    request,
    project: list.project,
    scripts,
    totalBillableWords: canApply ? totalBillableWords : undefined,
    parsingSignature: signature.finish(list.files.length),
    canApply,
  };
}
