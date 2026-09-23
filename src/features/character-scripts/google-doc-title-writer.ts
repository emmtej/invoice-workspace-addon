import {
  characterNameFromFileName,
  formatCharacterScriptTitleLines,
  planCharacterScriptTitleHeader,
} from '../../shared/character-script-title';
import { collectGoogleDocTabs } from '../../shared/google-doc-tabs';
import type { NumberedProjectName } from '../../shared/workspace-domain';

const HEADER_FONT_SIZE_PT = 18;

export interface TitleHeaderElement {
  getType(): unknown;
}

export interface TitleHeaderParagraph {
  getText(): string;
  setText(text: string): void;
  editAsText(): {
    setBold(start: number, endInclusive: number, bold: boolean): void;
    setFontSize(start: number, endInclusive: number, size: number): void;
  };
  removeFromParent(): void;
  getNumChildren(): number;
  getChild(index: number): TitleHeaderElement;
}

export interface TitleHeaderBodyChild extends TitleHeaderElement {
  asParagraph?(): TitleHeaderParagraph;
}

export interface TitleHeaderBody {
  getNumChildren(): number;
  getChild(index: number): TitleHeaderBodyChild;
  insertParagraph(childIndex: number, text: string): TitleHeaderParagraph;
}

export interface TitleHeaderGoogleDocTab {
  getChildTabs(): TitleHeaderGoogleDocTab[];
  asDocumentTab(): { getBody(): TitleHeaderBody };
}

export interface TitleHeaderGoogleDoc {
  getTabs(): TitleHeaderGoogleDocTab[];
  saveAndClose(): void;
}

export interface TitleHeaderGoogleDocOpener {
  openById(id: string): TitleHeaderGoogleDoc;
}

export type GoogleDocTitleWriteResult =
  | { status: 'skipped' }
  | { status: 'updated' }
  | {
      status: 'failed';
      reason:
        | 'empty-character-name'
        | 'ambiguous-header'
        | 'multiple-tabs'
        | 'access-denied'
        | 'unsupported-google-doc-structure'
        | 'write-failed';
    };

function isParagraphType(type: unknown): boolean {
  return String(type) === 'PARAGRAPH';
}

function isPlainTextParagraph(paragraph: TitleHeaderParagraph): boolean {
  const count = paragraph.getNumChildren();
  for (let index = 0; index < count; index += 1) {
    if (String(paragraph.getChild(index).getType()) !== 'TEXT') {
      return false;
    }
  }
  return true;
}

function styleHeaderParagraph(
  paragraph: TitleHeaderParagraph,
  text: string,
): void {
  paragraph.setText(text);
  if (text.length === 0) {
    return;
  }
  const end = text.length - 1;
  const rich = paragraph.editAsText();
  rich.setBold(0, end, true);
  rich.setFontSize(0, end, HEADER_FONT_SIZE_PT);
}

function collectParagraphPrefix(body: TitleHeaderBody): {
  childIndex: number;
  paragraph: TitleHeaderParagraph;
}[] {
  const prefix: { childIndex: number; paragraph: TitleHeaderParagraph }[] = [];
  const count = body.getNumChildren();
  for (let childIndex = 0; childIndex < count; childIndex += 1) {
    const child = body.getChild(childIndex);
    if (!isParagraphType(child.getType()) || !child.asParagraph) {
      break;
    }
    prefix.push({ childIndex, paragraph: child.asParagraph() });
  }
  return prefix;
}

export function writeGoogleDocTitleHeader(
  file: { id: string; name: string },
  project: NumberedProjectName,
  opener: TitleHeaderGoogleDocOpener,
): GoogleDocTitleWriteResult {
  const characterName = characterNameFromFileName(file.name);
  if (characterName.length === 0) {
    return { status: 'failed', reason: 'empty-character-name' };
  }
  try {
    const document = opener.openById(file.id);
    const tabs = collectGoogleDocTabs(document.getTabs(), (tab) =>
      tab.getChildTabs(),
    );
    if (tabs.length !== 1) {
      return { status: 'failed', reason: 'multiple-tabs' };
    }
    const body = tabs[0].asDocumentTab().getBody();
    const prefix = collectParagraphPrefix(body);
    const expected = formatCharacterScriptTitleLines(project, characterName);
    const edit = planCharacterScriptTitleHeader(
      prefix.map((entry) => entry.paragraph.getText()),
      expected,
    );
    if (edit.action === 'skip') {
      return { status: 'skipped' };
    }
    if (edit.action === 'failed') {
      return { status: 'failed', reason: 'ambiguous-header' };
    }
    if (edit.action === 'insert') {
      for (let offset = 0; offset < edit.lines.length; offset += 1) {
        const paragraph = body.insertParagraph(offset, '');
        styleHeaderParagraph(paragraph, edit.lines[offset]);
      }
      document.saveAndClose();
      return { status: 'updated' };
    }
    const existing = prefix.slice(edit.start, edit.start + edit.deleteCount);
    if (existing.some((entry) => !isPlainTextParagraph(entry.paragraph))) {
      return { status: 'failed', reason: 'unsupported-google-doc-structure' };
    }
    const shared = Math.min(existing.length, edit.lines.length);
    for (let offset = 0; offset < shared; offset += 1) {
      styleHeaderParagraph(existing[offset].paragraph, edit.lines[offset]);
    }
    const insertAt =
      existing.length === 0 ? 0 : existing[shared - 1].childIndex + 1;
    for (let offset = shared; offset < edit.lines.length; offset += 1) {
      const paragraph = body.insertParagraph(
        insertAt + (offset - shared),
        '',
      );
      styleHeaderParagraph(paragraph, edit.lines[offset]);
    }
    for (
      let offset = existing.length - 1;
      offset >= edit.lines.length;
      offset -= 1
    ) {
      existing[offset].paragraph.removeFromParent();
    }
    document.saveAndClose();
    return { status: 'updated' };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/permission|denied|access|unauthorized|not found/i.test(message)) {
      return { status: 'failed', reason: 'access-denied' };
    }
    return { status: 'failed', reason: 'write-failed' };
  }
}
