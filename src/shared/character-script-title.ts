import type { NumberedProjectName } from './workspace-domain';

const SCRIPT_BODY_LINE = /^(?:Scene\b|\d{1,2}:\d{2}\b)/i;
const NUMBERED_HEADER_LINE = /^\d+\s+/;

export type TitleHeaderEdit =
  | { action: 'skip' }
  | { action: 'insert'; start: 0; lines: readonly string[] }
  | {
      action: 'replace';
      start: number;
      deleteCount: number;
      lines: readonly string[];
    }
  | { action: 'failed'; reason: 'ambiguous-header' };

export function characterNameFromFileName(fileName: string): string {
  return fileName.replace(/\.(docx|doc)$/i, '').trim();
}

export function splitProjectTitleLines(title: string): string[] {
  const titleLines: string[] = [];
  let remaining = title;
  while (remaining.length > 0) {
    const bang = remaining.indexOf('!');
    if (bang === -1) {
      const leftover = remaining.trim();
      if (leftover.length > 0) {
        titleLines.push(leftover);
      }
      break;
    }
    const segment = remaining.slice(0, bang).trim();
    if (segment.length > 0) {
      titleLines.push(`${segment}!`);
    }
    remaining = remaining.slice(bang + 1);
  }
  return titleLines;
}

export function formatCharacterScriptTitleLines(
  project: NumberedProjectName,
  characterName: string,
): string[] {
  const titleLines = splitProjectTitleLines(project.title);
  if (titleLines.length === 0) {
    titleLines.push(String(project.number));
  } else {
    titleLines[0] = `${project.number} ${titleLines[0]}`;
  }
  titleLines.push(characterName);
  return titleLines;
}

export function planCharacterScriptTitleHeader(
  paragraphs: readonly string[],
  expected: readonly string[],
): TitleHeaderEdit {
  let index = 0;
  while (index < paragraphs.length && paragraphs[index].trim() === '') {
    index += 1;
  }
  const headerStart = index;
  if (index + expected.length <= paragraphs.length) {
    const windowMatches = expected.every(
      (line, offset) => paragraphs[index + offset].trim() === line,
    );
    if (windowMatches) {
      return { action: 'skip' };
    }
  }

  if (
    index >= paragraphs.length ||
    !NUMBERED_HEADER_LINE.test(paragraphs[index].trim())
  ) {
    return { action: 'insert', start: 0, lines: expected };
  }

  const characterName = expected[expected.length - 1];
  let cursor = index + 1;
  while (cursor < paragraphs.length) {
    const trimmed = paragraphs[cursor].trim();
    if (trimmed === '' || SCRIPT_BODY_LINE.test(trimmed)) {
      break;
    }
    if (trimmed === characterName) {
      return {
        action: 'replace',
        start: headerStart,
        deleteCount: cursor + 1 - headerStart,
        lines: expected,
      };
    }
    cursor += 1;
  }
  return { action: 'failed', reason: 'ambiguous-header' };
}
