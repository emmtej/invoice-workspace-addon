import {
  DOCX_LIMITS,
  isEncryptionPart,
  normalizeDocxPartName,
  type DocxUnzippedEntry,
} from '../../shared/docx/package';
import { extractDocxText } from './docx-text';
import {
  unavailableResult,
  type ScriptContentReadResult,
} from './script-content';

// Preserve the legacy DOCX size gate: any high surrogate counts as four bytes
// and consumes the next code unit, even when absent or not a low surrogate.
// shared/utf8.ts instead counts lone surrogate code units as three bytes.
// Do not unify these counters without a separate behavior decision.
function docxXmlByteLength(text: string): number {
  let count = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code <= 0x7f) {
      count += 1;
    } else if (code <= 0x7ff) {
      count += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      count += 4;
      index += 1;
    } else {
      count += 3;
    }
  }
  return count;
}

function toAppsScriptBytes(bytes: Uint8Array): number[] {
  return Array.from(bytes, (byte) => (byte > 0x7f ? byte - 0x100 : byte));
}

export function unzipDocxWithUtilities(bytes: Uint8Array): DocxUnzippedEntry[] {
  const blob = Utilities.newBlob(
    toAppsScriptBytes(bytes),
    'application/zip',
    'script.docx',
  );
  return Utilities.unzip(blob).map((entry) => {
    const name = entry.getName() ?? '';
    const content = entry.getBytes();
    const isDocumentXml = normalizeDocxPartName(name) === 'word/document.xml';
    return {
      name,
      size: content.length,
      text: isDocumentXml ? entry.getDataAsString('UTF-8') : undefined,
    };
  });
}

export function readDocxPackage(input: {
  entries?: readonly DocxUnzippedEntry[];
  unzipError?: unknown;
}): ScriptContentReadResult {
  if (input.unzipError !== undefined) {
    return unavailableResult('invalid-docx', 'corrupt-package');
  }

  const entries = input.entries ?? [];
  const validationFailure =
    validatePackageEntries(entries) ?? validateDocumentXmlSizes(entries);
  if (validationFailure) {
    return validationFailure;
  }

  const extracted = extractDocxText(
    entries.map((entry) => ({
      name: entry.name,
      text: entry.text ?? '',
    })),
  );
  if (extracted.status === 'ready') {
    return extracted;
  }
  return unavailableResult(extracted.reason, extracted.detail);
}

function validatePackageEntries(
  entries: readonly DocxUnzippedEntry[],
): ScriptContentReadResult | undefined {
  if (entries.length > DOCX_LIMITS.maxPackageEntries) {
    return unavailableResult('file-too-large');
  }

  let expandedBytes = 0;
  for (const entry of entries) {
    expandedBytes += entry.size;
    if (expandedBytes > DOCX_LIMITS.maxExpandedBytes) {
      return unavailableResult('file-too-large');
    }
    if (isEncryptionPart(entry.name)) {
      return unavailableResult('invalid-docx', 'encrypted-package');
    }
  }
  return undefined;
}

function validateDocumentXmlSizes(
  entries: readonly DocxUnzippedEntry[],
): ScriptContentReadResult | undefined {
  for (const entry of entries) {
    if (normalizeDocxPartName(entry.name) === 'word/document.xml') {
      const xmlBytes =
        entry.text === undefined ? entry.size : docxXmlByteLength(entry.text);
      if (
        entry.size > DOCX_LIMITS.maxDocumentXmlBytes ||
        xmlBytes > DOCX_LIMITS.maxDocumentXmlBytes
      ) {
        return unavailableResult('file-too-large');
      }
    }
  }

  return undefined;
}
