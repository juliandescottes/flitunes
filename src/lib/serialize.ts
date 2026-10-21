// Conversion between the in-memory library and library.json.
// The output is deterministic (fixed key order, sorted entries) so that
// editing one album produces a small git diff.

import { isValidCover, isValidSpotifyUri, SCHEMA_VERSION, type Album, type Genre, type LibraryFile } from "./model.ts";

export class LibraryFormatError extends Error {}

export function toLibraryFile(albums: Album[], genres: Genre[], exportedAt: string): LibraryFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    genres: [...genres].sort(byId).map(normalizeGenre),
    albums: [...albums].sort(byId).map(normalizeAlbum),
  };
}

export function serializeLibraryFile(file: LibraryFile): string {
  return JSON.stringify(toLibraryFile(file.albums, file.genres, file.exportedAt), null, 2) + "\n";
}

export function parseLibraryFile(text: string): LibraryFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new LibraryFormatError(`Invalid JSON: ${(e as Error).message}`);
  }
  if (!isObject(data)) throw new LibraryFormatError("Expected a JSON object");
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new LibraryFormatError(`Unsupported schemaVersion: ${String(data.schemaVersion)}`);
  }
  if (typeof data.exportedAt !== "string" || Number.isNaN(Date.parse(data.exportedAt))) {
    throw new LibraryFormatError("Missing or invalid exportedAt");
  }
  if (!Array.isArray(data.genres) || !Array.isArray(data.albums)) {
    throw new LibraryFormatError("Expected genres and albums arrays");
  }
  const genres = data.genres.map((g, i) => parseGenre(g, i));
  const albums = data.albums.map((a, i) => parseAlbum(a, i));

  const genreIds = new Set(genres.map((g) => g.id));
  for (const album of albums) {
    const unknown = album.genres.find((id) => !genreIds.has(id));
    if (unknown) throw new LibraryFormatError(`Album ${album.id} references unknown genre "${unknown}"`);
  }
  assertUniqueIds(genres, "genre");
  assertUniqueIds(albums, "album");

  return { schemaVersion: SCHEMA_VERSION, exportedAt: data.exportedAt, genres, albums };
}

function parseGenre(value: unknown, index: number): Genre {
  const where = `genres[${index}]`;
  if (!isObject(value)) throw new LibraryFormatError(`${where}: expected an object`);
  return { id: str(value.id, `${where}.id`), name: str(value.name, `${where}.name`) };
}

function parseAlbum(value: unknown, index: number): Album {
  const where = `albums[${index}]`;
  if (!isObject(value)) throw new LibraryFormatError(`${where}: expected an object`);
  const rating = nullableNumber(value.rating, `${where}.rating`);
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
    throw new LibraryFormatError(`${where}.rating: expected 1-5 or null`);
  }
  // Strict: both end up in the page (a link, an image source).
  const spotify = nullableStr(value.spotify, `${where}.spotify`);
  if (spotify !== null && !isValidSpotifyUri(spotify)) {
    throw new LibraryFormatError(`${where}.spotify: expected a spotify:album: or spotify:playlist: URI`);
  }
  const cover = nullableStr(value.cover, `${where}.cover`);
  if (cover !== null && !isValidCover(cover)) {
    throw new LibraryFormatError(`${where}.cover: expected an https: URL or a covers/ file`);
  }
  return {
    id: str(value.id, `${where}.id`),
    title: str(value.title, `${where}.title`),
    artists: strArray(value.artists, `${where}.artists`),
    artistSort: nullableStr(value.artistSort, `${where}.artistSort`),
    year: nullableNumber(value.year, `${where}.year`),
    genres: strArray(value.genres, `${where}.genres`),
    tags: strArray(value.tags, `${where}.tags`),
    rating,
    notes: value.notes === undefined ? "" : str(value.notes, `${where}.notes`),
    spotify,
    cover,
    addedAt: str(value.addedAt, `${where}.addedAt`),
  };
}

// Rebuild objects with a fixed key order (and drop unknown keys).
function normalizeGenre(g: Genre): Genre {
  return { id: g.id, name: g.name };
}

function normalizeAlbum(a: Album): Album {
  return {
    id: a.id,
    title: a.title,
    artists: [...a.artists],
    artistSort: a.artistSort,
    year: a.year,
    genres: [...a.genres],
    tags: [...a.tags].sort(),
    rating: a.rating,
    notes: a.notes,
    spotify: a.spotify,
    cover: a.cover,
    addedAt: a.addedAt,
  };
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function assertUniqueIds(items: { id: string }[], kind: string): void {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) throw new LibraryFormatError(`Duplicate ${kind} id "${id}"`);
    seen.add(id);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, where: string): string {
  if (typeof value !== "string") throw new LibraryFormatError(`${where}: expected a string`);
  return value;
}

function nullableStr(value: unknown, where: string): string | null {
  return value === null || value === undefined ? null : str(value, where);
}

function nullableNumber(value: unknown, where: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new LibraryFormatError(`${where}: expected a number or null`);
  }
  return value;
}

function strArray(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw new LibraryFormatError(`${where}: expected an array of strings`);
  }
  return [...value];
}
