import type { CardActionSpec, PagingView } from './models';

export function toPagingView(
  page: number,
  pageCount: number,
  actionForPage: (targetPage: number) => CardActionSpec,
): PagingView | undefined {
  if (pageCount <= 1) {
    return undefined;
  }
  const paging: PagingView = {
    label: `Page ${page + 1} of ${pageCount}`,
  };
  if (page > 0) {
    paging.previous = actionForPage(page - 1);
  }
  if (page + 1 < pageCount) {
    paging.next = actionForPage(page + 1);
  }
  return paging;
}
