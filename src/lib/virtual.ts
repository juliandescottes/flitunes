// Virtual scrolling: which rows of a long list to render, and how to scroll
// a row into view when it may not be rendered. Rows have a fixed height.

/** Rows rendered above and below the visible ones, so fast scrolls don't flash. */
export const OVERSCAN = 8;

/** The rows [start, end) to render for a viewport `top` pixels down a list of `count` rows. */
export function visibleRows(
  top: number,
  viewport: number,
  rowHeight: number,
  count: number,
  overscan = OVERSCAN,
): { start: number; end: number } {
  if (count === 0 || rowHeight <= 0) return { start: 0, end: 0 };
  const first = Math.floor(Math.max(0, top) / rowHeight);
  const last = Math.ceil((Math.max(0, top) + Math.max(0, viewport)) / rowHeight);
  return {
    start: Math.max(0, Math.min(count, first - overscan)),
    end: Math.max(0, Math.min(count, last + overscan)),
  };
}

/**
 * The scroll position that shows the row spanning [rowTop, rowTop + rowHeight),
 * moving as little as possible, or null when it is already in view. `inset`
 * is the part of the viewport hidden at its top (e.g. a sticky header).
 */
export function revealRow(
  rowTop: number,
  rowHeight: number,
  scrollTop: number,
  viewport: number,
  inset = 0,
): number | null {
  if (rowTop - inset < scrollTop) return Math.max(0, rowTop - inset);
  if (rowTop + rowHeight > scrollTop + viewport) return rowTop + rowHeight - viewport;
  return null;
}

/**
 * The visible height of a scrolling element. clientHeight rounds a
 * fractional height up, which would leave a revealed row slightly cut off.
 */
export function viewportHeight(element: HTMLElement): number {
  return Math.min(element.clientHeight, Math.floor(element.getBoundingClientRect().height));
}
