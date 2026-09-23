export const INVOICE_PARSING_SIGNATURE_VERSION = 'v3';

const SIGNATURE_PATTERN = new RegExp(
  `^${INVOICE_PARSING_SIGNATURE_VERSION}-[0-9a-f]{16}-\\d+$`,
);

export interface InvoiceParsingSignatureBuilder {
  add(value: string): void;
  finish(fileCount: number): string;
}

/**
 * Builds a deterministic optimistic-concurrency marker. This is deliberately
 * not a cryptographic digest and must never be used for authentication,
 * authorization, tamper evidence, or adversarial collision resistance.
 */
export function createInvoiceParsingSignatureBuilder(): InvoiceParsingSignatureBuilder {
  let first = 0x811c9dc5;
  let second = 0x9747b28c;

  return {
    add(value) {
      const framed = `${value.length}:${value}`;
      for (let index = 0; index < framed.length; index++) {
        const code = framed.charCodeAt(index);
        first ^= code;
        first = Math.imul(first, 0x01000193);
        second ^= code;
        second = Math.imul(second, 0x5bd1e995);
      }
    },

    finish(fileCount) {
      if (!Number.isSafeInteger(fileCount) || fileCount < 0) {
        throw new Error('Parsing-signature file count must be non-negative.');
      }
      const firstHex = (first >>> 0).toString(16).padStart(8, '0');
      const secondHex = (second >>> 0).toString(16).padStart(8, '0');
      return `${INVOICE_PARSING_SIGNATURE_VERSION}-${firstHex}${secondHex}-${fileCount}`;
    },
  };
}

export function isInvoiceParsingSignature(value: string): boolean {
  return SIGNATURE_PATTERN.test(value);
}
