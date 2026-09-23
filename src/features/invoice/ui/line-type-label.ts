import type { ScriptLineKind } from '../script-parsing';

export function lineTypeLabel(lineType: ScriptLineKind): string {
  return lineType === 'non-dialogue'
    ? 'Non-dialogue'
    : `${lineType.charAt(0).toUpperCase()}${lineType.slice(1)}`;
}
