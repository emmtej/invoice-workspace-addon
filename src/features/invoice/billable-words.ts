import type { ParsedScript } from './script-parsing';

export function countBillableWords(spokenText: string): number {
  const trimmed = spokenText.trim();
  if (trimmed === '') {
    return 0;
  }
  return trimmed.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token))
    .length;
}

export function calculateBillableWordsFromParsedScript(
  parsed: ParsedScript,
): number {
  let total = 0;
  for (const line of parsed.lines) {
    if (line.kind === 'dialogue') {
      total += countBillableWords(line.spokenText);
    }
  }
  return total;
}
