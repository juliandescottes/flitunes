export const SCHEMA_VERSION = 1;

/** Artist name used for compilations. */
export const VARIOUS_ARTISTS = "Various Artists";

/**
 * Tag of albums imported in bulk and not reviewed yet. They only show in the
 * Triage source, hidden from the rest of the library until accepted.
 */
export const TRIAGE_TAG = "triage";

export interface Genre {
  /** Slug, e.g. "jazz". */
  id: string;
  name: string;
}

export interface Album {
  /** ULID, generated locally. */
  id: string;
  title: string;
  artists: string[];
  /** Overrides the first artist for sorting, e.g. "Beatles, The". */
  artistSort: string | null;
  year: number | null;
  /** Genre ids. The first one is the primary genre. */
  genres: string[];
  tags: string[];
  /** 1-5, or null when unrated. */
  rating: number | null;
  notes: string;
  /** Spotify album or playlist URI, e.g. "spotify:album:1weenld61qoidwYuZ1GESA". */
  spotify: string | null;
  cover: string | null;
  addedAt: string;
}

export interface LibraryFile {
  schemaVersion: number;
  exportedAt: string;
  genres: Genre[];
  albums: Album[];
}

export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Finds an existing genre with the same name, ignoring case and punctuation. */
export function findGenreByName(genres: Genre[], name: string): Genre | undefined {
  const id = slugify(name);
  return id ? genres.find((g) => g.id === id || slugify(g.name) === id) : undefined;
}

/**
 * Key for spotting the same album entered twice: artist and title, ignoring
 * case, accents and punctuation. Letters of every script count (unlike
 * `slugify`, which keeps a-z and 0-9 for ids); a title with no letters or
 * digits, like Sigur Rós's "( )", is compared as is.
 */
export function albumMatchKey(artist: string, title: string): string {
  return `${matchText(sortableName(artist))}/${matchText(title) || title.trim()}`;
}

function matchText(text: string): string {
  return (
    text
      // NFKD splits accents off and reads full-width letters as plain ones;
      // NFC puts back the marks that aren't accents (Japanese voiced kana).
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .normalize("NFC")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
  );
}

/** Name for sorting, ignoring a leading "The " like iTunes: "The Beatles" → "Beatles". */
export function sortableName(name: string): string {
  return name.replace(/^the\s+/i, "");
}
