export const INVOICE_PROJECT_PAGE_SIZE = 25;

export const INVOICE_SCRIPT_RESULTS_PAGE_SIZE = 20;

interface CardPage<T> {
  items: readonly T[];
  pageCount: number;
}

export function getCardPage<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
  unavailableMessage: string,
): CardPage<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  if (!Number.isSafeInteger(page) || page < 0 || page >= pageCount) {
    throw new Error(unavailableMessage);
  }
  const start = page * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    pageCount,
  };
}
