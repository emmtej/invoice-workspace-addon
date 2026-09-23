import { normalizeTextNewlines } from '../../shared/text';

export type ScriptLineKind = 'blank' | 'metadata' | 'non-dialogue' | 'dialogue';

export interface ScriptLineBase {
  kind: ScriptLineKind;
  raw: string;
  lineIndex: number;
}

export interface ScriptBlankLine extends ScriptLineBase {
  kind: 'blank';
}

export interface ScriptMetadataLine extends ScriptLineBase {
  kind: 'metadata';
}

interface ScriptTimestampLineBase extends ScriptLineBase {
  timestamp: string;
  characters: string[];
  text: string;
}

export interface ScriptNonDialogueLine extends ScriptTimestampLineBase {
  kind: 'non-dialogue';
  instructions: string[];
}

export interface ScriptDialogueLine extends ScriptTimestampLineBase {
  kind: 'dialogue';
  spokenText: string;
}

export type ScriptLine =
  | ScriptBlankLine
  | ScriptMetadataLine
  | ScriptNonDialogueLine
  | ScriptDialogueLine;

type ScriptTimestampLine = ScriptNonDialogueLine | ScriptDialogueLine;

export interface PossibleUnstructuredDialogueWarning {
  code: 'possible-unstructured-dialogue';
  nonDialogueLineIndex: number;
  metadataLineIndexes: number[];
}

export interface InvalidSpeakerWarning {
  code: 'invalid-speaker';
  lineIndex: number;
}

export type ScriptParseWarning =
  | PossibleUnstructuredDialogueWarning
  | InvalidSpeakerWarning;

export interface ParsedScript {
  lines: ScriptLine[];
  warnings: ScriptParseWarning[];
}

const TIMESTAMP_LINE_PATTERN = /^\s*(\d{2}:\d{2})(\s*)([^:]*):\s*(.*)$/;

interface ClassifiedLine {
  line: ScriptLine;
  warning?: ScriptParseWarning;
}

function normalizeScriptText(text: string): string {
  return normalizeTextNewlines(text);
}

function splitScriptLines(text: string): string[] {
  const normalized = normalizeScriptText(text);
  return normalized === '' ? [] : normalized.split('\n');
}

function extractInstructions(text: string): string[] {
  const instructions: string[] = [];
  const pattern = /\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const instruction = match[1].trim();
    if (instruction) {
      instructions.push(instruction);
    }
  }
  return instructions;
}

function extractSpokenText(text: string): string {
  return text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTimestampLine(
  raw: string,
  lineIndex: number,
  match: RegExpExecArray,
  characters: string[],
): ScriptTimestampLine {
  const timestamp = match[1];
  const text = match[4].trim();
  const instructions = extractInstructions(text);
  const spokenText = extractSpokenText(text);

  if (instructions.length > 0 && spokenText === '') {
    return {
      kind: 'non-dialogue',
      raw,
      lineIndex,
      timestamp,
      characters,
      text,
      instructions,
    };
  }

  return {
    kind: 'dialogue',
    raw,
    lineIndex,
    timestamp,
    characters,
    text,
    spokenText,
  };
}

function classifyLine(raw: string, lineIndex: number): ClassifiedLine {
  if (raw.trim() === '') {
    return { line: { kind: 'blank', raw, lineIndex } };
  }

  const match = TIMESTAMP_LINE_PATTERN.exec(raw);
  if (!match) {
    return { line: { kind: 'metadata', raw, lineIndex } };
  }

  const characters = match[3].split('/').map((name) => name.trim());
  const hasValidSpeaker =
    match[2].length > 0 &&
    characters.length > 0 &&
    characters.every((name) => name.length > 0);
  if (!hasValidSpeaker) {
    return {
      line: { kind: 'metadata', raw, lineIndex },
      warning: { code: 'invalid-speaker', lineIndex },
    };
  }

  return {
    line: parseTimestampLine(raw, lineIndex, match, characters),
  };
}

function findPossibleUnstructuredDialogue(
  lines: readonly ScriptLine[],
): ScriptParseWarning[] {
  const warnings: ScriptParseWarning[] = [];
  for (let index = 0; index < lines.length; index++) {
    if (lines[index].kind !== 'non-dialogue') {
      continue;
    }

    const metadataLineIndexes: number[] = [];
    for (
      let continuationIndex = index + 1;
      continuationIndex < lines.length &&
      lines[continuationIndex].kind === 'metadata';
      continuationIndex++
    ) {
      metadataLineIndexes.push(lines[continuationIndex].lineIndex);
    }

    if (metadataLineIndexes.length > 0) {
      warnings.push({
        code: 'possible-unstructured-dialogue',
        nonDialogueLineIndex: lines[index].lineIndex,
        metadataLineIndexes,
      });
    }
  }
  return warnings;
}

function parseScriptLines(lines: readonly string[]): ParsedScript {
  const classifiedLines = lines.map((raw, lineIndex) =>
    classifyLine(raw, lineIndex),
  );
  const parsedLines = classifiedLines.map(({ line }) => line);
  return {
    lines: parsedLines,
    warnings: [
      ...classifiedLines.flatMap(({ warning }) =>
        warning === undefined ? [] : [warning],
      ),
      ...findPossibleUnstructuredDialogue(parsedLines),
    ],
  };
}

export function parseScriptText(text: string): ParsedScript {
  return parseScriptLines(splitScriptLines(text));
}
