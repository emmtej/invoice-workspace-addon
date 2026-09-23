import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { normalizeDocxPartName } from '../../shared/docx/package';

export type DocxTextExtractionResult =
  | { status: 'ready'; text: string }
  | {
      status: 'unavailable';
      reason: 'invalid-docx' | 'unsupported-docx-structure';
      detail?: string;
    };

export interface DocxPackagePart {
  name: string;
  text: string;
}

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MC_NS = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const OFFICE_2010_WORD_NS =
  'http://schemas.microsoft.com/office/word/2010/wordml';
const DOCUMENT_PART_NAME = 'word/document.xml';

const UNSUPPORTED_WORD_LOCAL_NAMES = new Set([
  // Run and range revisions.
  'ins',
  'del',
  'delText',
  'delInstrText',
  'moveFrom',
  'moveTo',
  'moveFromRangeStart',
  'moveFromRangeEnd',
  'moveToRangeStart',
  'moveToRangeEnd',
  'customXmlInsRangeStart',
  'customXmlInsRangeEnd',
  'customXmlDelRangeStart',
  'customXmlDelRangeEnd',
  'customXmlMoveFromRangeStart',
  'customXmlMoveFromRangeEnd',
  'customXmlMoveToRangeStart',
  'customXmlMoveToRangeEnd',
  // Property and table revisions.
  'numberingChange',
  'pPrChange',
  'rPrChange',
  'sectPrChange',
  'tblGridChange',
  'tblPrChange',
  'tblPrExChange',
  'tcPrChange',
  'trPrChange',
  'cellIns',
  'cellDel',
  'cellMerge',
  // Visible content that lives outside the supported main-document text model.
  'txbxContent',
  'altChunk',
  'contentPart',
  'subDoc',
  'object',
  'control',
]);

const UNSUPPORTED_OFFICE_2010_WORD_LOCAL_NAMES = new Set([
  'conflictIns',
  'conflictDel',
  'customXmlConflictInsRangeStart',
  'customXmlConflictInsRangeEnd',
  'customXmlConflictDelRangeStart',
  'customXmlConflictDelRangeEnd',
]);

const SKIP_WORD_LOCAL_NAMES = new Set([
  'pPr',
  'rPr',
  'sectPr',
  'sdtPr',
  'tblPr',
  'tblGrid',
  'trPr',
  'tcPr',
]);

type FxpNode = Record<string, unknown>;
type NamespaceMap = Record<string, string>;

const DOCTYPE_OR_ENTITY = /<!DOCTYPE\b|<!ENTITY\b/i;

const xmlParser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: {
    enabled: true,
    maxEntitySize: 32,
    maxExpansionDepth: 1,
    maxTotalExpansions: 10_000,
    maxExpandedLength: 1_000_000,
    maxEntityCount: 5,
  },
  ignoreDeclaration: true,
  commentPropName: '#comment',
});

function unavailable(
  reason: 'invalid-docx' | 'unsupported-docx-structure',
  detail?: string,
): DocxTextExtractionResult {
  return detail === undefined
    ? { status: 'unavailable', reason }
    : { status: 'unavailable', reason, detail };
}

function isRecord(value: unknown): value is FxpNode {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function elementName(node: FxpNode): string | undefined {
  for (const key of Object.keys(node)) {
    if (key !== ':@' && key !== '#text' && key !== '#comment') {
      return key;
    }
  }
  return undefined;
}

function elementChildren(node: FxpNode, name: string): unknown[] {
  const children = node[name];
  return Array.isArray(children) ? children : [];
}

function elementAttributes(node: FxpNode): Record<string, string> {
  const raw = node[':@'];
  if (!isRecord(raw)) {
    return {};
  }

  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      attributes[key.startsWith('@_') ? key.slice(2) : key] = value;
    }
  }
  return attributes;
}

function childNamespaces(
  parent: NamespaceMap,
  attributes: Record<string, string>,
): NamespaceMap {
  const next = { ...parent };
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'xmlns') {
      next[''] = value;
    } else if (name.startsWith('xmlns:')) {
      next[name.slice(6)] = value;
    }
  }
  return next;
}

function splitQualifiedName(name: string): {
  prefix: string;
  localName: string;
} {
  const index = name.indexOf(':');
  if (index === -1) {
    return { prefix: '', localName: name };
  }
  return {
    prefix: name.slice(0, index),
    localName: name.slice(index + 1),
  };
}

function localNameOf(name: string): string {
  return splitQualifiedName(name).localName;
}

function namespaceUri(name: string, namespaces: NamespaceMap): string {
  return namespaces[splitQualifiedName(name).prefix] ?? '';
}

function isWord(
  name: string,
  namespaces: NamespaceMap,
  localName: string,
): boolean {
  return (
    namespaceUri(name, namespaces) === WORD_NS &&
    localNameOf(name) === localName
  );
}

function textOf(children: readonly unknown[]): string {
  let text = '';
  for (const child of children) {
    if (isRecord(child) && typeof child['#text'] === 'string') {
      text += child['#text'];
    }
  }
  return text;
}

function extractParagraph(
  nodes: readonly unknown[],
  namespaces: NamespaceMap,
): string {
  let text = '';
  for (const node of nodes) {
    if (!isRecord(node)) {
      continue;
    }

    const name = elementName(node);
    if (!name) {
      continue;
    }

    const childNs = childNamespaces(namespaces, elementAttributes(node));
    const uri = namespaceUri(name, childNs);
    if (isWord(name, childNs, 't')) {
      text += textOf(elementChildren(node, name));
      continue;
    }
    if (isWord(name, childNs, 'tab')) {
      text += '\t';
      continue;
    }
    if (isWord(name, childNs, 'br') || isWord(name, childNs, 'cr')) {
      text += '\n';
      continue;
    }
    if (uri !== WORD_NS || SKIP_WORD_LOCAL_NAMES.has(localNameOf(name))) {
      continue;
    }

    text += extractParagraph(elementChildren(node, name), childNs);
  }
  return text;
}

function collectParagraphs(
  nodes: readonly unknown[],
  namespaces: NamespaceMap,
  paragraphs: string[],
): void {
  for (const node of nodes) {
    if (!isRecord(node)) {
      continue;
    }

    const name = elementName(node);
    if (!name) {
      continue;
    }

    const childNs = childNamespaces(namespaces, elementAttributes(node));
    if (namespaceUri(name, childNs) !== WORD_NS) {
      continue;
    }
    if (isWord(name, childNs, 'p')) {
      paragraphs.push(extractParagraph(elementChildren(node, name), childNs));
      continue;
    }

    collectParagraphs(elementChildren(node, name), childNs, paragraphs);
  }
}

function findUnsupported(
  nodes: readonly unknown[],
  namespaces: NamespaceMap,
): string | undefined {
  for (const node of nodes) {
    if (!isRecord(node)) {
      continue;
    }

    const name = elementName(node);
    if (!name) {
      continue;
    }

    const childNs = childNamespaces(namespaces, elementAttributes(node));
    const uri = namespaceUri(name, childNs);
    const localName = localNameOf(name);
    if (uri === WORD_NS && UNSUPPORTED_WORD_LOCAL_NAMES.has(localName)) {
      return localName;
    }
    if (
      uri === OFFICE_2010_WORD_NS &&
      UNSUPPORTED_OFFICE_2010_WORD_LOCAL_NAMES.has(localName)
    ) {
      return localName;
    }
    if (uri === MC_NS && localName === 'AlternateContent') {
      return localName;
    }

    const nested = findUnsupported(elementChildren(node, name), childNs);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

function findWordChildren(
  parent: FxpNode,
  parentName: string,
  namespaces: NamespaceMap,
  localName: string,
): Array<{ node: FxpNode; name: string; namespaces: NamespaceMap }> {
  const matches: Array<{
    node: FxpNode;
    name: string;
    namespaces: NamespaceMap;
  }> = [];
  for (const child of elementChildren(parent, parentName)) {
    if (!isRecord(child)) {
      continue;
    }
    const name = elementName(child);
    if (!name) {
      continue;
    }
    const childNs = childNamespaces(namespaces, elementAttributes(child));
    if (isWord(name, childNs, localName)) {
      matches.push({ node: child, name, namespaces: childNs });
    }
  }
  return matches;
}

function extractDocumentXml(xml: string): DocxTextExtractionResult {
  if (DOCTYPE_OR_ENTITY.test(xml)) {
    return unavailable('invalid-docx', 'doctype');
  }

  if (XMLValidator.validate(xml) !== true) {
    return unavailable('invalid-docx', 'malformed-xml');
  }

  let parsed: unknown;
  try {
    parsed = xmlParser.parse(xml);
  } catch {
    return unavailable('invalid-docx', 'malformed-xml');
  }

  if (!Array.isArray(parsed)) {
    return unavailable('invalid-docx', 'malformed-xml');
  }

  const root = parsed.find(
    (node): node is FxpNode =>
      isRecord(node) && elementName(node) !== undefined,
  );
  if (!root) {
    return unavailable('invalid-docx', 'malformed-xml');
  }

  const rootName = elementName(root);
  if (!rootName) {
    return unavailable('invalid-docx', 'malformed-xml');
  }

  const rootNs = childNamespaces({}, elementAttributes(root));
  if (!isWord(rootName, rootNs, 'document')) {
    return unavailable('invalid-docx', localNameOf(rootName));
  }

  const bodies = findWordChildren(root, rootName, rootNs, 'body');
  if (bodies.length !== 1) {
    return unavailable(
      'invalid-docx',
      bodies.length === 0 ? 'missing-body' : 'duplicate-body',
    );
  }

  const body = bodies[0];
  const unsupported = findUnsupported(
    elementChildren(body.node, body.name),
    body.namespaces,
  );
  if (unsupported) {
    return unavailable('unsupported-docx-structure', unsupported);
  }

  const paragraphs: string[] = [];
  collectParagraphs(
    elementChildren(body.node, body.name),
    body.namespaces,
    paragraphs,
  );
  return { status: 'ready', text: paragraphs.join('\n') };
}

export function extractDocxText(
  parts: readonly DocxPackagePart[],
): DocxTextExtractionResult {
  const matches = parts.filter(
    (part) => normalizeDocxPartName(part.name) === DOCUMENT_PART_NAME,
  );
  if (matches.length === 0) {
    return unavailable('invalid-docx', 'missing-document-xml');
  }
  if (matches.length > 1) {
    return unavailable('invalid-docx', 'duplicate-document-xml');
  }
  return extractDocumentXml(matches[0].text);
}
