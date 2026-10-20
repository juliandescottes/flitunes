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
  // Filtering keeps the order, so the whole library is sorted once (cached)
  // and every filter below works on sorted lists.
  const sorted = sortedLibrary(albums, genres, genreNames, state.sortKey, state.sortDir);
  const ranks = nameRanks(albums);
  const base = sorted.filter(
    (a) =>
      inSource(a, state.source, now) &&
      (!state.linkedOnly || a.spotify !== null) &&
      matchesSearch(a, words, genres, genreNames),
  );

  const genreList = genreItems(base, genreNames);
  const genre = effective(state.genre, genreList);
  const byGenre = genre === null ? base : base.filter((a) => a.genres.includes(genre));

  const artistList = artistItems(byGenre, ranks.artists);
  const artist = effective(state.artist, artistList);
  const byArtist = artist === null ? byGenre : byGenre.filter((a) => a.artists.includes(artist));

  const titleList = albumTitleItems(byArtist, ranks.titles);
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
    albums: shown,
  };
}

// The library's arrays are replaced, never mutated (see library.svelte.ts),
// so the last result can be reused while they are the same arrays.
let lastSort: { albums: Album[]; genres: Genre[]; key: SortKey; dir: SortDir; sorted: Album[] } | null = null;

function sortedLibrary(
  albums: Album[],
  genres: Genre[],
  genreNames: Map<string, string>,
  key: SortKey,
  dir: SortDir,
): Album[] {
  const last = lastSort;
  if (last && last.albums === albums && last.genres === genres && last.key === key && last.dir === dir) {
    return last.sorted;
  }
  const sorted = sortAlbums(albums, key, dir, genreNames);
  lastSort = { albums, genres, key, dir, sorted };
  return sorted;
}

interface NameRanks {
  /** Position of each artist, and of each album title, in the library's sorted order. */
  artists: Map<string, number>;
  titles: Map<string, number>;
}

let lastRanks: { albums: Album[]; ranks: NameRanks } | null = null;

// Sorting every name once lets the column lists sort by a number.
function nameRanks(albums: Album[]): NameRanks {
  if (lastRanks?.albums === albums) return lastRanks.ranks;
  // An artist sorts by the artistSort of an album they lead, else by name without "The".
  const sortNames = new Map<string, string>();
  for (const a of albums) {
    if (a.artistSort && a.artists[0]) sortNames.set(a.artists[0], a.artistSort);
  }
  const rank = (names: Set<string>, sortName: (name: string) => string) =>
    new Map(sortBy([...names], sortName).map((name, i) => [name, i]));
  const ranks = {
    artists: rank(new Set(albums.flatMap((a) => a.artists)), (name) => sortNames.get(name) ?? sortableName(name)),
    titles: rank(new Set(albums.map((a) => a.title)), sortableName),
  };
  lastRanks = { albums, ranks };
  return ranks;
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

// Folded search text per album. Albums are replaced, never mutated, on edit,
// and so is the genres array on a rename, so both can key a cache.
const searchTexts = new WeakMap<Genre[], WeakMap<Album, string>>();

function searchText(album: Album, genres: Genre[], genreNames: Map<string, string>): string {
  let texts = searchTexts.get(genres);
  if (!texts) searchTexts.set(genres, (texts = new WeakMap()));
  let text = texts.get(album);
  if (text === undefined) {
    text = fold(
      [
        album.title,
        ...album.artists,
        album.year ?? "",
        ...album.genres.map((id) => genreNames.get(id) ?? id),
        ...album.tags,
      ].join(" "),
    );
    texts.set(album, text);
  }
  return text;
}

/** Every search word must appear in the title, artists, year, genres or tags. */
function matchesSearch(album: Album, words: string[], genres: Genre[], genreNames: Map<string, string>): boolean {
  if (words.length === 0) return true;
  const text = searchText(album, genres, genreNames);
  return words.every((w) => text.includes(w));
}

function genreItems(albums: Album[], genreNames: Map<string, string>): ColumnItem[] {
  const counts = countBy(albums.flatMap((a) => a.genres));
  return [...counts]
    .map(([key, count]) => ({ key, label: genreNames.get(key) ?? key, count }))
    .sort((a, b) => compareText(a.label, b.label));
}

function artistItems(albums: Album[], ranks: Map<string, number>): ColumnItem[] {
  return [...countBy(albums.flatMap((a) => a.artists))]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => ranks.get(a.key)! - ranks.get(b.key)!);
}

function albumTitleItems(albums: Album[], ranks: Map<string, number>): ColumnItem[] {
  // Editions sharing a title are grouped under one entry.
  return [...countBy(albums.map((a) => a.title))]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => ranks.get(a.key)! - ranks.get(b.key)!);
}

/** Sorts by a text key computed once per item rather than once per comparison. */
function sortBy<T>(items: T[], key: (item: T) => string): T[] {
  const keyed = items.map((item) => ({ item, key: key(item) }));
  keyed.sort((a, b) => compareText(a.key, b.key));
  return keyed.map((k) => k.item);
}

export function sortAlbums(albums: Album[], key: SortKey, dir: SortDir, genreNames: Map<string, string>): Album[] {
  // Sort names are computed once per album, not once per comparison.
  type Keyed = { album: Album; artist: string; title: string; genre: string | null };
  const keyed: Keyed[] = albums.map((album) => ({
    album,
    artist: artistSortName(album),
    title: sortableName(album.title),
    genre: key === "genre" ? genreName(album, genreNames) : null,
  }));
  const byArtist = (a: Keyed, b: Keyed) => compareText(a.artist, b.artist);
  const byTitle = (a: Keyed, b: Keyed) => compareText(a.title, b.title);
  const byYear = (a: Keyed, b: Keyed) => compareNullable(a.album.year, b.album.year, 1);
  // Ties are broken like iTunes: artist, then year, then title.
  const tieBreak = (a: Keyed, b: Keyed) => byArtist(a, b) || byYear(a, b) || byTitle(a, b);
  const sign = dir === "asc" ? 1 : -1;
  const primary: Record<SortKey, (a: Keyed, b: Keyed) => number> = {
    title: (a, b) => sign * byTitle(a, b),
    artist: (a, b) => sign * byArtist(a, b),
    year: (a, b) => compareNullable(a.album.year, b.album.year, sign),
    genre: (a, b) => compareNullable(a.genre, b.genre, sign),
    rating: (a, b) => compareNullable(a.album.rating, b.album.rating, sign),
    addedAt: (a, b) => sign * a.album.addedAt.localeCompare(b.album.addedAt),
  };
  const compare = primary[key];
  keyed.sort((a, b) => compare(a, b) || tieBreak(a, b));
  return keyed.map((k) => k.album);
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
