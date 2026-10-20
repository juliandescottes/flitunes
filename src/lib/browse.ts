// Browsing logic for the iTunes-style window: source list, search, the
// Genres | Artists | Albums column browser and the sorted main view.
// Pure functions so they can be tested without the UI.

import { sortableName, type Album, type Genre } from "./model.ts";

export type Source = { kind: "music" } | { kind: "recent" } | { kind: "playlist"; tag: string };

/** "Recently Added" covers albums added in the last 30 days. */
export const RECENT_DAYS = 30;

export type ViewMode = "list" | "grid";

export type SortKey = "title" | "artist" | "year" | "genre" | "rating" | "addedAt";
export type SortDir = "asc" | "desc";

export interface BrowseState {
  source: Source;
  search: string;
  /** Hide albums without a Spotify link. */
  linkedOnly: boolean;
  /** Column browser selections; null means "All". */
  genre: string | null;
  artist: string | null;
  album: string | null;
  sortKey: SortKey;
  sortDir: SortDir;
}

export interface ColumnItem {
  key: string;
  label: string;
  count: number;
}

export interface BrowseResult {
  genres: ColumnItem[];
  artists: ColumnItem[];
  albumTitles: ColumnItem[];
  /** The effective selections: a selection that's no longer listed falls back to All. */
  genre: string | null;
  artist: string | null;
  album: string | null;
  /** Number of albums in the source after search and the link filter, before the column browser. */
  total: number;
  /** The albums shown in the main view, sorted. */
  albums: Album[];
}

export function browse(albums: Album[], genres: Genre[], state: BrowseState, now = Date.now()): BrowseResult {
  const genreNames = new Map(genres.map((g) => [g.id, g.name]));
  const words = searchWords(state.search);
  const base = albums.filter(
    (a) =>
      inSource(a, state.source, now) &&
      (!state.linkedOnly || a.spotify !== null) &&
      matchesSearch(a, words, genreNames),
  );

  const genreList = genreItems(base, genreNames);
  const genre = effective(state.genre, genreList);
  const byGenre = genre === null ? base : base.filter((a) => a.genres.includes(genre));

  const artistList = artistItems(byGenre);
  const artist = effective(state.artist, artistList);
  const byArtist = artist === null ? byGenre : byGenre.filter((a) => a.artists.includes(artist));

  const titleList = albumTitleItems(byArtist);
  const album = effective(state.album, titleList);
  const shown = album === null ? byArtist : byArtist.filter((a) => a.title === album);

  return {
    genres: genreList,
    artists: artistList,
    albumTitles: titleList,
    genre,
    artist,
    album,
    total: base.length,
    albums: sortAlbums(shown, state.sortKey, state.sortDir, genreNames),
  };
}

export function inSource(album: Album, source: Source, now = Date.now()): boolean {
  switch (source.kind) {
    case "music":
      return true;
    case "recent":
      return now - Date.parse(album.addedAt) <= RECENT_DAYS * 24 * 60 * 60 * 1000;
    case "playlist":
      return album.tags.includes(source.tag);
  }
}

/** Playlist names: every tag in use, sorted. */
export function playlists(albums: Album[]): string[] {
  return [...new Set(albums.flatMap((a) => a.tags))].sort(compareText);
}

function searchWords(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

/** Every search word must appear in the title, artists, year, genres or tags. */
function matchesSearch(album: Album, words: string[], genreNames: Map<string, string>): boolean {
  if (words.length === 0) return true;
  const text = fold(
    [
      album.title,
      ...album.artists,
      album.year ?? "",
      ...album.genres.map((id) => genreNames.get(id) ?? id),
      ...album.tags,
    ].join(" "),
  );
  return words.every((w) => text.includes(w));
}

function genreItems(albums: Album[], genreNames: Map<string, string>): ColumnItem[] {
  const counts = countBy(albums.flatMap((a) => a.genres));
  return [...counts]
    .map(([key, count]) => ({ key, label: genreNames.get(key) ?? key, count }))
    .sort((a, b) => compareText(a.label, b.label));
}

function artistItems(albums: Album[]): ColumnItem[] {
  // An artist sorts by the artistSort of an album they lead, else by name without "The".
  const sortNames = new Map<string, string>();
  for (const a of albums) {
    if (a.artistSort && a.artists[0]) sortNames.set(a.artists[0], a.artistSort);
  }
  const counts = countBy(albums.flatMap((a) => a.artists));
  const sortName = (name: string) => sortNames.get(name) ?? sortableName(name);
  return [...counts]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => compareText(sortName(a.key), sortName(b.key)));
}

function albumTitleItems(albums: Album[]): ColumnItem[] {
  // Editions sharing a title are grouped under one entry.
  return [...countBy(albums.map((a) => a.title))]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => compareText(sortableName(a.key), sortableName(b.key)));
}

export function sortAlbums(albums: Album[], key: SortKey, dir: SortDir, genreNames: Map<string, string>): Album[] {
  const byArtist = (a: Album, b: Album) => compareText(artistSortName(a), artistSortName(b));
  const byTitle = (a: Album, b: Album) => compareText(sortableName(a.title), sortableName(b.title));
  const byYear = (a: Album, b: Album) => compareNullable(a.year, b.year, 1);
  // Ties are broken like iTunes: artist, then year, then title.
  const tieBreak = (a: Album, b: Album) => byArtist(a, b) || byYear(a, b) || byTitle(a, b);
  const sign = dir === "asc" ? 1 : -1;
  const primary: Record<SortKey, (a: Album, b: Album) => number> = {
    title: (a, b) => sign * byTitle(a, b),
    artist: (a, b) => sign * byArtist(a, b),
    year: (a, b) => compareNullable(a.year, b.year, sign),
    genre: (a, b) => compareNullable(genreName(a, genreNames), genreName(b, genreNames), sign),
    rating: (a, b) => compareNullable(a.rating, b.rating, sign),
    addedAt: (a, b) => sign * a.addedAt.localeCompare(b.addedAt),
  };
  return [...albums].sort((a, b) => primary[key](a, b) || tieBreak(a, b));
}

/** Name of the album's primary genre, or null. */
export function genreName(album: Album, genreNames: Map<string, string>): string | null {
  const id = album.genres[0];
  return id === undefined ? null : (genreNames.get(id) ?? id);
}

/**
 * Type-ahead, like iTunes: the first album whose sorted column starts with
 * `prefix`. Columns without text (rating, date added) match on the name.
 */
export function typeAhead(
  albums: Album[],
  prefix: string,
  key: SortKey,
  genreNames: Map<string, string>,
): Album | null {
  const wanted = fold(prefix);
  if (!wanted) return null;
  const text = (a: Album): string => {
    if (key === "artist") return artistSortName(a);
    if (key === "genre") return genreName(a, genreNames) ?? "";
    if (key === "year") return a.year?.toString() ?? "";
    return sortableName(a.title);
  };
  return albums.find((a) => fold(text(a)).startsWith(wanted)) ?? null;
}

function artistSortName(album: Album): string {
  return album.artistSort ?? sortableName(album.artists[0] ?? "");
}

function effective(selected: string | null, items: ColumnItem[]): string | null {
  return selected !== null && items.some((i) => i.key === selected) ? selected : null;
}

function countBy(keys: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return counts;
}

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

function compareText(a: string, b: string): number {
  return collator.compare(a, b);
}

/** Compares in the direction of `sign`, with missing values (null) always last. */
function compareNullable<T extends string | number>(a: T | null, b: T | null, sign: number): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return sign * (typeof a === "number" ? a - (b as number) : compareText(a, b as string));
}

function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
