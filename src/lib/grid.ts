// Geometry of the grid view (AlbumGrid's CSS must match), shared with the
// tracks view so an album's cover stays where the grid's first cover was.

export const GRID_PADDING = 16;
export const GRID_MIN_COLUMN = 150;
export const GRID_COLUMN_GAP = 12;
export const GRID_ROW_GAP = 18;
/** Padding around each item, inside its column. */
export const GRID_ITEM_PADDING = 6;

/** Columns in a grid `width` pixels wide: the same count as the CSS grid's auto-fill. */
export function gridColumns(width: number): number {
  return Math.max(1, Math.floor((width - 2 * GRID_PADDING + GRID_COLUMN_GAP) / (GRID_MIN_COLUMN + GRID_COLUMN_GAP)));
}

/** The width (and height) of a cover in a grid `width` pixels wide. */
export function gridCoverSize(width: number): number {
  const columns = gridColumns(width);
  const column = (width - 2 * GRID_PADDING - (columns - 1) * GRID_COLUMN_GAP) / columns;
  return Math.max(0, column - 2 * GRID_ITEM_PADDING);
}
