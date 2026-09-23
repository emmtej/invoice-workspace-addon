import {
  DOCX_LIMITS,
  isEncryptionPart,
  normalizeDocxPartName,
} from './package';

export type DocxArchivePreflightResult =
  | { status: 'ready' }
  | {
      status: 'unavailable';
      reason: 'file-too-large' | 'invalid-docx';
      detail?: string;
    };

const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;

const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;

const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

const ZIP_END_OF_CENTRAL_DIRECTORY_MIN_BYTES = 22;

const ZIP_MAX_COMMENT_BYTES = 65_535;

const ZIP64_UINT16_SENTINEL = 0xffff;

const ZIP64_UINT32_SENTINEL = 0xffffffff;

type PreflightFailure = Extract<
  DocxArchivePreflightResult,
  { status: 'unavailable' }
>;

interface CentralDirectory {
  status: 'ready';
  offset: number;
  end: number;
  totalEntries: number;
}

interface CentralDirectoryEntry {
  status: 'ready';
  offset: number;
  nextOffset: number;
  name: string;
  nameLength: number;
  flags: number;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

function preflightUnavailable(
  reason: 'file-too-large' | 'invalid-docx',
  detail?: string,
): PreflightFailure {
  return detail === undefined
    ? { status: 'unavailable', reason }
    : { status: 'unavailable', reason, detail };
}

function readUint16Le(bytes: Uint8Array, offset: number): number | undefined {
  if (offset < 0 || offset + 2 > bytes.length) {
    return undefined;
  }
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(
    0,
    true,
  );
}

function readUint32Le(bytes: Uint8Array, offset: number): number | undefined {
  if (offset < 0 || offset + 4 > bytes.length) {
    return undefined;
  }
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(
    0,
    true,
  );
}

function findEndOfCentralDirectory(bytes: Uint8Array): number | undefined {
  const firstPossibleOffset = Math.max(
    0,
    bytes.length -
      ZIP_END_OF_CENTRAL_DIRECTORY_MIN_BYTES -
      ZIP_MAX_COMMENT_BYTES,
  );
  for (
    let offset = bytes.length - ZIP_END_OF_CENTRAL_DIRECTORY_MIN_BYTES;
    offset >= firstPossibleOffset;
    offset--
  ) {
    if (
      readUint32Le(bytes, offset) !== ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      continue;
    }
    const commentLength = readUint16Le(bytes, offset + 20);
    if (
      commentLength !== undefined &&
      offset + ZIP_END_OF_CENTRAL_DIRECTORY_MIN_BYTES + commentLength ===
        bytes.length
    ) {
      return offset;
    }
  }
  return undefined;
}

function asciiEntryName(
  bytes: Uint8Array,
  offset: number,
  length: number,
): string {
  let name = '';
  for (let index = offset; index < offset + length; index++) {
    const byte = bytes[index];
    name += byte <= 0x7f ? String.fromCharCode(byte) : '\uFFFD';
  }
  return name;
}

function byteRangesEqual(
  bytes: Uint8Array,
  firstOffset: number,
  secondOffset: number,
  length: number,
): boolean {
  if (
    firstOffset < 0 ||
    secondOffset < 0 ||
    firstOffset + length > bytes.length ||
    secondOffset + length > bytes.length
  ) {
    return false;
  }
  for (let index = 0; index < length; index++) {
    if (bytes[firstOffset + index] !== bytes[secondOffset + index]) {
      return false;
    }
  }
  return true;
}

export function preflightDocxArchive(
  bytes: Uint8Array,
): DocxArchivePreflightResult {
  // Compressed length is enforced by readScriptContent before this runs.
  // Central-directory uncompressed sizes below are advertised (APPNOTE
  // §4.4.8–4.4.9), including when general-purpose bit 3 defers sizes to
  // the data descriptor. This is not a proof that hosted unzip will
  // stay inside DOCX_LIMITS.
  const directory = readCentralDirectory(bytes);
  if (directory.status === 'unavailable') {
    return directory;
  }
  return validateDirectoryEntries(bytes, directory);
}

function readCentralDirectory(
  bytes: Uint8Array,
): CentralDirectory | PreflightFailure {
  const endOffset = findEndOfCentralDirectory(bytes);
  if (endOffset === undefined) {
    return preflightUnavailable('invalid-docx', 'missing-central-directory');
  }

  const diskNumber = readUint16Le(bytes, endOffset + 4);
  const centralDirectoryDisk = readUint16Le(bytes, endOffset + 6);
  const entriesOnDisk = readUint16Le(bytes, endOffset + 8);
  const totalEntries = readUint16Le(bytes, endOffset + 10);
  const centralDirectorySize = readUint32Le(bytes, endOffset + 12);
  const centralDirectoryOffset = readUint32Le(bytes, endOffset + 16);
  if (
    diskNumber === undefined ||
    centralDirectoryDisk === undefined ||
    entriesOnDisk === undefined ||
    totalEntries === undefined ||
    centralDirectorySize === undefined ||
    centralDirectoryOffset === undefined
  ) {
    return preflightUnavailable('invalid-docx', 'malformed-central-directory');
  }
  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== totalEntries
  ) {
    return preflightUnavailable('invalid-docx', 'multi-disk-archive');
  }
  if (
    totalEntries === ZIP64_UINT16_SENTINEL ||
    centralDirectorySize === ZIP64_UINT32_SENTINEL ||
    centralDirectoryOffset === ZIP64_UINT32_SENTINEL
  ) {
    return preflightUnavailable('invalid-docx', 'unsupported-zip64');
  }
  if (totalEntries > DOCX_LIMITS.maxPackageEntries) {
    return preflightUnavailable('file-too-large');
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd !== endOffset || centralDirectoryEnd > bytes.length) {
    return preflightUnavailable('invalid-docx', 'malformed-central-directory');
  }

  return {
    status: 'ready',
    offset: centralDirectoryOffset,
    end: centralDirectoryEnd,
    totalEntries,
  };
}

function readCentralDirectoryEntry(
  bytes: Uint8Array,
  offset: number,
  centralDirectoryEnd: number,
): CentralDirectoryEntry | PreflightFailure {
  if (
    offset + 46 > centralDirectoryEnd ||
    readUint32Le(bytes, offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE
  ) {
    return preflightUnavailable(
      'invalid-docx',
      'malformed-central-directory',
    );
  }

  const flags = readUint16Le(bytes, offset + 8);
  const compressionMethod = readUint16Le(bytes, offset + 10);
  const compressedSize = readUint32Le(bytes, offset + 20);
  const uncompressedSize = readUint32Le(bytes, offset + 24);
  const nameLength = readUint16Le(bytes, offset + 28);
  const extraLength = readUint16Le(bytes, offset + 30);
  const commentLength = readUint16Le(bytes, offset + 32);
  const startingDisk = readUint16Le(bytes, offset + 34);
  const localHeaderOffset = readUint32Le(bytes, offset + 42);
  if (
    flags === undefined ||
    compressionMethod === undefined ||
    compressedSize === undefined ||
    uncompressedSize === undefined ||
    nameLength === undefined ||
    extraLength === undefined ||
    commentLength === undefined ||
    startingDisk === undefined ||
    localHeaderOffset === undefined
  ) {
    return preflightUnavailable(
      'invalid-docx',
      'malformed-central-directory',
    );
  }
  if (
    compressedSize === ZIP64_UINT32_SENTINEL ||
    uncompressedSize === ZIP64_UINT32_SENTINEL ||
    localHeaderOffset === ZIP64_UINT32_SENTINEL
  ) {
    return preflightUnavailable('invalid-docx', 'unsupported-zip64');
  }
  if (startingDisk !== 0) {
    return preflightUnavailable('invalid-docx', 'multi-disk-archive');
  }
  // Traditional ZIP encryption bits (APPNOTE general-purpose flags).
  // Not Office OLE password wrappers.
  if ((flags & 0x0001) !== 0 || (flags & 0x0040) !== 0) {
    return preflightUnavailable('invalid-docx', 'encrypted-package');
  }
  if (compressionMethod !== 0 && compressionMethod !== 8) {
    return preflightUnavailable('invalid-docx', 'unsupported-compression');
  }
  if (compressionMethod === 0 && compressedSize !== uncompressedSize) {
    return preflightUnavailable('invalid-docx', 'malformed-zip-entry');
  }

  const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
  if (nextOffset > centralDirectoryEnd) {
    return preflightUnavailable(
      'invalid-docx',
      'malformed-central-directory',
    );
  }
  const name = asciiEntryName(bytes, offset + 46, nameLength);

  return {
    status: 'ready',
    offset,
    nextOffset,
    name,
    nameLength,
    flags,
    compressionMethod,
    compressedSize,
    uncompressedSize,
    localHeaderOffset,
  };
}

function validateLocalHeader(
  bytes: Uint8Array,
  entry: CentralDirectoryEntry,
  centralDirectoryOffset: number,
): DocxArchivePreflightResult {
  const {
    offset,
    nameLength,
    flags,
    compressionMethod,
    compressedSize,
    uncompressedSize,
    localHeaderOffset,
  } = entry;
  if (
    localHeaderOffset + 30 > centralDirectoryOffset ||
    readUint32Le(bytes, localHeaderOffset) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE
  ) {
    return preflightUnavailable('invalid-docx', 'malformed-local-header');
  }
  const localNameLength = readUint16Le(bytes, localHeaderOffset + 26);
  const localExtraLength = readUint16Le(bytes, localHeaderOffset + 28);
  const localFlags = readUint16Le(bytes, localHeaderOffset + 6);
  const localCompressionMethod = readUint16Le(bytes, localHeaderOffset + 8);
  const localCompressedSize = readUint32Le(bytes, localHeaderOffset + 18);
  const localUncompressedSize = readUint32Le(bytes, localHeaderOffset + 22);
  if (
    localNameLength === undefined ||
    localExtraLength === undefined ||
    localFlags === undefined ||
    localCompressionMethod === undefined ||
    localCompressedSize === undefined ||
    localUncompressedSize === undefined
  ) {
    return preflightUnavailable('invalid-docx', 'malformed-local-header');
  }
  const localDataOffset =
    localHeaderOffset + 30 + localNameLength + localExtraLength;
  if (
    localDataOffset + compressedSize > centralDirectoryOffset ||
    localNameLength !== nameLength ||
    localFlags !== flags ||
    localCompressionMethod !== compressionMethod ||
    ((flags & 0x0008) === 0 &&
      (localCompressedSize !== compressedSize ||
        localUncompressedSize !== uncompressedSize)) ||
    !byteRangesEqual(bytes, localHeaderOffset + 30, offset + 46, nameLength)
  ) {
    return preflightUnavailable('invalid-docx', 'malformed-local-header');
  }

  return { status: 'ready' };
}

function validateDirectoryEntries(
  bytes: Uint8Array,
  directory: CentralDirectory,
): DocxArchivePreflightResult {
  const {
    offset: centralDirectoryOffset,
    end: centralDirectoryEnd,
    totalEntries,
  } = directory;
  let offset = centralDirectoryOffset;
  let expandedBytes = 0;
  let documentXmlCount = 0;
  for (let index = 0; index < totalEntries; index++) {
    const entry = readCentralDirectoryEntry(bytes, offset, centralDirectoryEnd);
    if (entry.status === 'unavailable') {
      return entry;
    }
    const { name, uncompressedSize } = entry;
    expandedBytes += uncompressedSize;
    if (expandedBytes > DOCX_LIMITS.maxExpandedBytes) {
      return preflightUnavailable('file-too-large');
    }
    if (isEncryptionPart(name)) {
      return preflightUnavailable('invalid-docx', 'encrypted-package');
    }
    if (normalizeDocxPartName(name) === 'word/document.xml') {
      documentXmlCount++;
      if (uncompressedSize > DOCX_LIMITS.maxDocumentXmlBytes) {
        return preflightUnavailable('file-too-large');
      }
    }

    const localHeader = validateLocalHeader(
      bytes,
      entry,
      centralDirectoryOffset,
    );
    if (localHeader.status === 'unavailable') {
      return localHeader;
    }
    offset = entry.nextOffset;
  }

  if (offset !== centralDirectoryEnd) {
    return preflightUnavailable('invalid-docx', 'malformed-central-directory');
  }
  if (documentXmlCount !== 1) {
    return preflightUnavailable(
      'invalid-docx',
      documentXmlCount === 0
        ? 'missing-document-xml'
        : 'duplicate-document-xml',
    );
  }
  return { status: 'ready' };
}
