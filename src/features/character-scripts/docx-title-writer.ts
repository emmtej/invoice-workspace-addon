import { XMLValidator } from 'fast-xml-parser';
import {
  characterNameFromFileName,
  formatCharacterScriptTitleLines,
  planCharacterScriptTitleHeader,
} from '../../shared/character-script-title';
import {
  readDriveBlob,
  toAppsScriptSignedBytes,
  toUint8Array,
  type DriveBlobReader,
} from '../../shared/drive/blob-io';
import {
  DOCX_LIMITS,
  isEncryptionPart,
  normalizeDocxPartName,
} from '../../shared/docx/package';
import { preflightDocxArchive } from '../../shared/docx/zip-preflight';
import {
  DOCX_MIME_TYPE,
  type NumberedProjectName,
} from '../../shared/workspace-domain';

const LISTED_SIZE_PATTERN = /^\d+$/;
const UNSUPPORTED_HEADER_TAG =
  /<(?:[\w-]+:)?(?:drawing|pict|object|control|sdt|sectPr|fldSimple|fldChar|instrText|ins|del|delText)\b/i;

export type DocxTitleWriteResult =
  | { status: 'skipped' }
  | { status: 'updated' }
  | { status: 'skipped'; reason: 'time-limit' }
  | {
      status: 'failed';
      reason:
        | 'empty-character-name'
        | 'ambiguous-header'
        | 'access-denied'
        | 'download-disabled'
        | 'download-failed'
        | 'invalid-file-metadata'
        | 'invalid-docx'
        | 'file-too-large'
        | 'unsupported-docx-structure'
        | 'write-failed';
    };

export interface DocxZipPart {
  name: string;
  bytes: Uint8Array;
}

function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function decodeXmlText(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_all, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_all, dec) =>
      String.fromCharCode(Number(dec)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function buildHeaderParagraphXml(text: string): string {
  const escaped = escapeXmlText(text);
  return `<w:p><w:pPr><w:rPr><w:b w:val="1"/><w:bCs w:val="1"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:pPr><w:r><w:rPr><w:b w:val="1"/><w:bCs w:val="1"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
}

function isNamedTagAt(
  source: string,
  index: number,
  rawName: string,
  closing: boolean,
): boolean {
  const prefix = closing ? `</${rawName}` : `<${rawName}`;
  if (!source.startsWith(prefix, index)) {
    return false;
  }
  const next = source.charAt(index + prefix.length);
  return next === '>' || next === ' ' || next === '/' || next === '\t' || next === '\n';
}

function findMatchingClose(
  source: string,
  start: number,
  rawName: string,
): number {
  let depth = 1;
  let index = start;
  const closeTag = `</${rawName}>`;
  while (index < source.length && depth > 0) {
    const nextClose = source.indexOf(closeTag, index);
    if (nextClose === -1) {
      return -1;
    }
    let nextOpen = source.indexOf(`<${rawName}`, index);
    while (
      nextOpen !== -1 &&
      nextOpen < nextClose &&
      !isNamedTagAt(source, nextOpen, rawName, false)
    ) {
      nextOpen = source.indexOf(`<${rawName}`, nextOpen + 1);
    }
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      index = nextOpen + rawName.length + 1;
    } else {
      depth -= 1;
      if (depth === 0) {
        return nextClose;
      }
      index = nextClose + closeTag.length;
    }
  }
  return -1;
}

function splitTopLevelElements(source: string): string[] {
  const parts: string[] = [];
  let index = 0;
  while (index < source.length) {
    if (source.charAt(index) !== '<') {
      const next = source.indexOf('<', index);
      const end = next === -1 ? source.length : next;
      parts.push(source.slice(index, end));
      index = end;
      continue;
    }
    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4);
      const close = end === -1 ? source.length : end + 3;
      parts.push(source.slice(index, close));
      index = close;
      continue;
    }
    if (source.startsWith('<![CDATA[', index)) {
      const end = source.indexOf(']]>', index + 9);
      const close = end === -1 ? source.length : end + 3;
      parts.push(source.slice(index, close));
      index = close;
      continue;
    }
    const gt = source.indexOf('>', index);
    if (gt === -1) {
      parts.push(source.slice(index));
      break;
    }
    const head = source.slice(index, gt + 1);
    if (
      head.startsWith('<?') ||
      head.startsWith('<!') ||
      /\/\s*>$/.test(head) ||
      head.startsWith('</')
    ) {
      parts.push(head);
      index = gt + 1;
      continue;
    }
    const nameMatch = /^<([A-Za-z0-9:]+)/.exec(head);
    const rawName = nameMatch ? nameMatch[1] : '';
    const closeAt = findMatchingClose(source, gt + 1, rawName);
    if (closeAt === -1) {
      return [];
    }
    const closing = `</${rawName}>`;
    parts.push(source.slice(index, closeAt + closing.length));
    index = closeAt + closing.length;
  }
  return parts;
}

function elementLocalName(elementXml: string): string {
  const match = /^<\/?([A-Za-z0-9:]+)/.exec(elementXml.trim());
  if (!match) {
    return '';
  }
  const name = match[1];
  const colon = name.indexOf(':');
  return (colon === -1 ? name : name.slice(colon + 1)).toLowerCase();
}

function isParagraphElement(elementXml: string): boolean {
  const trimmed = elementXml.trim();
  return trimmed.startsWith('<') && elementLocalName(trimmed) === 'p';
}

function collectTextNodes(paragraphXml: string): string {
  const texts: string[] = [];
  const matcher = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let match = matcher.exec(paragraphXml);
  while (match) {
    texts.push(decodeXmlText(match[1]));
    match = matcher.exec(paragraphXml);
  }
  return texts.join('');
}

function paragraphHasUnsupportedHeaderContent(paragraphXml: string): boolean {
  const inner = paragraphXml
    .replace(/^<[^>]+>/, '')
    .replace(/<\/[^>]+>$/, '');
  if (/<(?:[\w-]+:)?p\b/.test(inner)) {
    return true;
  }
  return UNSUPPORTED_HEADER_TAG.test(paragraphXml);
}

function splitDocumentBody(xml: string): {
  prefix: string;
  nodes: string[];
  suffix: string;
} | undefined {
  const bodyOpen = xml.indexOf('<w:body');
  if (bodyOpen === -1) {
    return undefined;
  }
  const bodyStart = xml.indexOf('>', bodyOpen);
  if (bodyStart === -1) {
    return undefined;
  }
  const bodyClose = xml.indexOf('</w:body>', bodyStart);
  if (bodyClose === -1) {
    return undefined;
  }
  const nodes = splitTopLevelElements(xml.slice(bodyStart + 1, bodyClose));
  if (nodes.length === 0 && xml.slice(bodyStart + 1, bodyClose).trim() !== '') {
    return undefined;
  }
  return {
    prefix: xml.slice(0, bodyStart + 1),
    nodes,
    suffix: xml.slice(bodyClose),
  };
}

function collectHeaderParagraphs(nodes: readonly string[]): {
  nodeIndex: number;
  xml: string;
  text: string;
}[] {
  const paragraphs: {
    nodeIndex: number;
    xml: string;
    text: string;
  }[] = [];
  for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
    const node = nodes[nodeIndex];
    if (node.trim() === '') {
      continue;
    }
    if (!isParagraphElement(node)) {
      break;
    }
    paragraphs.push({
      nodeIndex,
      xml: node,
      text: collectTextNodes(node),
    });
  }
  return paragraphs;
}

export function rewriteDocumentXmlTitleHeader(
  xml: string,
  expected: readonly string[],
): { status: 'skipped' | 'updated'; xml: string } | {
  status: 'failed';
  reason: 'unsupported-docx-structure' | 'invalid-docx' | 'ambiguous-header';
} {
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) {
    return { status: 'failed', reason: 'invalid-docx' };
  }
  if (XMLValidator.validate(xml) !== true) {
    return { status: 'failed', reason: 'invalid-docx' };
  }
  const body = splitDocumentBody(xml);
  if (!body) {
    return { status: 'failed', reason: 'unsupported-docx-structure' };
  }
  const headerParagraphs = collectHeaderParagraphs(body.nodes);
  const edit = planCharacterScriptTitleHeader(
    headerParagraphs.map((paragraph) => paragraph.text),
    expected,
  );
  if (edit.action === 'skip') {
    return { status: 'skipped', xml };
  }
  if (edit.action === 'failed') {
    return { status: 'failed', reason: 'ambiguous-header' };
  }
  const headerXml = expected.map((line) => buildHeaderParagraphXml(line));
  let nextNodes: string[];
  if (edit.action === 'insert') {
    nextNodes = [...headerXml, ...body.nodes];
  } else {
    const range = headerParagraphs.slice(
      edit.start,
      edit.start + edit.deleteCount,
    );
    if (range.some((paragraph) => paragraphHasUnsupportedHeaderContent(paragraph.xml))) {
      return { status: 'failed', reason: 'unsupported-docx-structure' };
    }
    const firstNodeIndex = range[0].nodeIndex;
    const lastNodeIndex = range[range.length - 1].nodeIndex;
    nextNodes = [
      ...body.nodes.slice(0, firstNodeIndex),
      ...headerXml,
      ...body.nodes.slice(lastNodeIndex + 1),
    ];
  }
  const rewritten = `${body.prefix}${nextNodes.join('')}${body.suffix}`;
  if (XMLValidator.validate(rewritten) !== true) {
    return { status: 'failed', reason: 'invalid-docx' };
  }
  return { status: 'updated', xml: rewritten };
}

export function unzipDocxParts(bytes: Uint8Array): DocxZipPart[] {
  const blob = Utilities.newBlob(
    toAppsScriptSignedBytes(bytes),
    'application/zip',
    'script.docx',
  );
  return Utilities.unzip(blob).map((entry) => ({
    name: entry.getName() ?? '',
    bytes: toUint8Array(entry.getBytes()),
  }));
}

export function zipDocxParts(parts: readonly DocxZipPart[]): Uint8Array {
  const blobs = parts.map((part) =>
    Utilities.newBlob(
      toAppsScriptSignedBytes(part.bytes),
      'application/octet-stream',
      part.name,
    ),
  );
  return toUint8Array(Utilities.zip(blobs).getBytes());
}

function listedCompressedSize(size: string | undefined): number | undefined {
  if (size === undefined || size === '') {
    return undefined;
  }
  if (!LISTED_SIZE_PATTERN.test(size)) {
    return undefined;
  }
  return Number(size);
}

function validateUnzippedParts(
  parts: readonly DocxZipPart[],
): DocxTitleWriteResult | undefined {
  if (parts.length > DOCX_LIMITS.maxPackageEntries) {
    return { status: 'failed', reason: 'file-too-large' };
  }
  let expanded = 0;
  const names = new Set<string>();
  let documentCount = 0;
  for (const part of parts) {
    expanded += part.bytes.length;
    if (expanded > DOCX_LIMITS.maxExpandedBytes) {
      return { status: 'failed', reason: 'file-too-large' };
    }
    if (isEncryptionPart(part.name)) {
      return { status: 'failed', reason: 'invalid-docx' };
    }
    const normalized = normalizeDocxPartName(part.name);
    if (names.has(normalized)) {
      return { status: 'failed', reason: 'invalid-docx' };
    }
    names.add(normalized);
    if (normalized === 'word/document.xml') {
      documentCount += 1;
      if (part.bytes.length > DOCX_LIMITS.maxDocumentXmlBytes) {
        return { status: 'failed', reason: 'file-too-large' };
      }
    }
  }
  if (documentCount !== 1) {
    return { status: 'failed', reason: 'invalid-docx' };
  }
  return undefined;
}

function decodeUtf8(bytes: Uint8Array): string {
  return Utilities.newBlob(
    toAppsScriptSignedBytes(bytes),
    'application/octet-stream',
  ).getDataAsString('UTF-8');
}

function encodeUtf8(text: string): Uint8Array {
  return toUint8Array(Utilities.newBlob(text).getBytes());
}

export function writeDocxTitleHeader(
  file: {
    id: string;
    name: string;
    size?: string;
    canDownload?: boolean;
  },
  project: NumberedProjectName,
  ports: {
    blobReader: DriveBlobReader;
    unzip: (bytes: Uint8Array) => DocxZipPart[];
    zip: (parts: readonly DocxZipPart[]) => Uint8Array;
    updateBinaryFile: (
      fileId: string,
      bytes: Uint8Array,
      mimeType: string,
    ) => void;
    decodeXml?: (bytes: Uint8Array) => string;
    encodeXml?: (text: string) => Uint8Array;
    canContinue?: () => boolean;
  },
): DocxTitleWriteResult {
  const characterName = characterNameFromFileName(file.name);
  if (characterName.length === 0) {
    return { status: 'failed', reason: 'empty-character-name' };
  }
  if (file.canDownload !== true) {
    return { status: 'failed', reason: 'download-disabled' };
  }
  const listedSize = listedCompressedSize(file.size);
  if (listedSize === undefined) {
    return { status: 'failed', reason: 'invalid-file-metadata' };
  }
  if (listedSize > DOCX_LIMITS.maxCompressedBytes) {
    return { status: 'failed', reason: 'file-too-large' };
  }
  const download = readDriveBlob(file.id, ports.blobReader);
  if (download.status === 'unavailable') {
    return {
      status: 'failed',
      reason:
        download.reason === 'access-denied' ? 'access-denied' : 'download-failed',
    };
  }
  if (download.bytes.length > DOCX_LIMITS.maxCompressedBytes) {
    return { status: 'failed', reason: 'file-too-large' };
  }
  const preflight = preflightDocxArchive(download.bytes);
  if (preflight.status === 'unavailable') {
    return {
      status: 'failed',
      reason:
        preflight.reason === 'file-too-large' ? 'file-too-large' : 'invalid-docx',
    };
  }
  let parts: DocxZipPart[];
  try {
    parts = ports.unzip(download.bytes);
  } catch {
    return { status: 'failed', reason: 'invalid-docx' };
  }
  const unzipError = validateUnzippedParts(parts);
  if (unzipError) {
    return unzipError;
  }
  const documentIndex = parts.findIndex(
    (part) => normalizeDocxPartName(part.name) === 'word/document.xml',
  );
  const decodeXml = ports.decodeXml ?? decodeUtf8;
  const encodeXml = ports.encodeXml ?? encodeUtf8;
  let documentXml: string;
  try {
    documentXml = decodeXml(parts[documentIndex].bytes);
  } catch {
    return { status: 'failed', reason: 'write-failed' };
  }
  const expected = formatCharacterScriptTitleLines(project, characterName);
  const rewritten = rewriteDocumentXmlTitleHeader(documentXml, expected);
  if (rewritten.status === 'failed') {
    return { status: 'failed', reason: rewritten.reason };
  }
  if (rewritten.status === 'skipped') {
    return { status: 'skipped' };
  }
  let encoded: Uint8Array;
  try {
    encoded = encodeXml(rewritten.xml);
  } catch {
    return { status: 'failed', reason: 'write-failed' };
  }
  if (encoded.length > DOCX_LIMITS.maxDocumentXmlBytes) {
    return { status: 'failed', reason: 'file-too-large' };
  }
  const nextParts = parts.map((part, index) =>
    index === documentIndex ? { ...part, bytes: encoded } : part,
  );
  let zipped: Uint8Array;
  try {
    zipped = ports.zip(nextParts);
  } catch {
    return { status: 'failed', reason: 'write-failed' };
  }
  if (zipped.length > DOCX_LIMITS.maxCompressedBytes) {
    return { status: 'failed', reason: 'file-too-large' };
  }
  if (ports.canContinue && !ports.canContinue()) {
    return { status: 'skipped', reason: 'time-limit' };
  }
  try {
    ports.updateBinaryFile(file.id, zipped, DOCX_MIME_TYPE);
    return { status: 'updated' };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/permission|denied|access|unauthorized|not found/i.test(message)) {
      return { status: 'failed', reason: 'access-denied' };
    }
    return { status: 'failed', reason: 'write-failed' };
  }
}
