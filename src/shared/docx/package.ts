export function normalizeDocxPartName(name: string): string {
  return name.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

export const DOCX_LIMITS = {
  maxCompressedBytes: 2_000_000,
  maxExpandedBytes: 8_000_000,
  maxPackageEntries: 64,
  maxDocumentXmlBytes: 1_000_000,
} as const;

export interface DocxUnzippedEntry {
  name: string;
  size: number;
  text?: string;
}

const ENCRYPTION_PART_NAMES = new Set(['encryptioninfo', 'encryptedpackage']);

// ZIP entry base names only. Office password-protected ECMA-376 files are
// OLE compound files with EncryptionInfo / EncryptedPackage *streams*
// (MS-OFFCRYPTO 1.3.3.4), not ZIP parts. Those containers have no EOCD
// and fail preflight as invalid-docx / missing-central-directory.
export function isEncryptionPart(name: string): boolean {
  const normalized = normalizeDocxPartName(name);
  const baseName = normalized.split('/').pop() ?? normalized;
  return ENCRYPTION_PART_NAMES.has(baseName);
}
