// Albums from a Spotify "Extended streaming history" export: the pure parts
// of history.ts and add-triage.ts (see README.md), kept here to be tested.

import { albumMatchKey, TRIAGE_TAG, VARIOUS_ARTISTS, type Album } from "../../src/lib/model.ts";

// --- 1. Aggregate ---------------------------------------------------------

/**
 * The only fields read from the export. The files also hold IP addresses,
 * devices and countries: they are never read.
 */
export interface Play {
  ts: string | null;
  ms_played: number | null;
  master_metadata_album_artist_name: string | null;
  master_metadata_album_album_name: string | null;
  spotify_track_uri: string | null;
}

/** A play of 30 seconds or more counts as a listen. */
export const MIN_LISTEN_MS = 30_000;

/** Listens to one (album artist, album name) pair, as named in the export. */
export interface Pair {
  artist: string;
  album: string;
  plays: number;
  /** Distinct track URIs listened to. */
  tracks_played: number;
  first_played: string;
  last_played: string;
  /** Id of the most listened track, to find the album on Spotify. */
  sample_track: string;
}

export function pairKey(p: { artist: string; album: string }): string {
  return JSON.stringify([p.artist, p.album]);
}

/** Adds up the listens per (album artist, album name). Podcasts and audiobooks (no track URI) are skipped. */
export function aggregate(plays: Iterable<Play>): Pair[] {
  type Acc = { artist: string; album: string; plays: number; tracks: Map<string, number>; first: string; last: string };
  const pairs = new Map<string, Acc>();
  for (const play of plays) {
    const track = /^spotify:track:([A-Za-z0-9]{22})$/.exec(play.spotify_track_uri ?? "")?.[1];
    const artist = play.master_metadata_album_artist_name;
    const album = play.master_metadata_album_album_name;
    if (!track || !artist || !album || (play.ms_played ?? 0) < MIN_LISTEN_MS) continue;
    const key = pairKey({ artist, album });
    let acc = pairs.get(key);
    if (!acc) pairs.set(key, (acc = { artist, album, plays: 0, tracks: new Map(), first: "", last: "" }));
    acc.plays++;
    acc.tracks.set(track, (acc.tracks.get(track) ?? 0) + 1);
    const day = (play.ts ?? "").slice(0, 10);
    if (day) {
      if (!acc.first || day < acc.first) acc.first = day;
      if (day > acc.last) acc.last = day;
    }
  }
  return [...pairs.values()].map((acc) => ({
    artist: acc.artist,
    album: acc.album,
    plays: acc.plays,
    tracks_played: acc.tracks.size,
    first_played: acc.first,
    last_played: acc.last,
    sample_track: [...acc.tracks].reduce((best, t) => (t[1] > best[1] ? t : best))[0],
  }));
}

/**
 * Keeps albums actually listened to as albums: enough listens, over enough
 * distinct tracks (a song replayed from a playlist isn't an album), most
 * played first.
 */
export function albumListens(pairs: Pair[], minPlays: number, minTracks: number) {
  const kept = pairs
    .filter((p) => p.plays >= minPlays && p.tracks_played >= minTracks)
    .sort((a, b) => b.plays - a.plays || compare(a.artist, b.artist) || compare(a.album, b.album));
  return {
    kept,
    fewPlays: pairs.filter((p) => p.plays < minPlays).length,
    fewTracks: pairs.filter((p) => p.tracks_played < minTracks).length,
  };
}

// --- 2. Spotify's public pages --------------------------------------------

/** What an album page says, from its <meta> tags. */
export interface SpotifyAlbum {
  /** null when og:title doesn't parse: the export's name is used instead. */
  title: string | null;
  artist: string;
  /** "album", "single", "EP" or "compilation". */
  type: string;
  year: string;
  total_tracks: number | null;
  release_date: string | null;
  /** The 640px cover. */
  cover: string | null;
}

/** One line of the resumable cache (history-albums.jsonl). */
export interface Resolved {
  artist: string;
  album: string;
  sample_track: string;
  status: "ok" | "failed";
  reason?: string;
  album_id?: string;
  spotify_album?: SpotifyAlbum;
}

/** The <meta> tags of a page, by property or name, entities decoded. The first of each wins. */
export function parseMetas(html: string): Map<string, string> {
  const metas = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\s[^>]*>/gi)) {
    const attrs = new Map([...tag.matchAll(/(property|name|content)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    const key = attrs.get("property") ?? attrs.get("name");
    const content = attrs.get("content");
    if (key && content !== undefined && !metas.has(key)) metas.set(key, decodeEntities(content));
  }
  return metas;
}

/** Whether a page looks like a real Spotify page (not a captcha or an error page). */
export function isSpotifyPage(metas: Map<string, string>): boolean {
  return metas.has("og:title") || metas.has("og:description");
}

/** The album id from a track page, or null (track without an album). */
export function trackAlbumId(metas: Map<string, string>): string | null {
  return /^https:\/\/open\.spotify\.com\/album\/([A-Za-z0-9]{22})$/.exec(metas.get("music:album") ?? "")?.[1] ?? null;
}

/** Reads an album page. Throws when its description doesn't have the expected shape. */
export function parseAlbumPage(metas: Map<string, string>): SpotifyAlbum {
  // "Nujabes · album · 2009 · 16 songs": from the right, as artist names can contain "·".
  const description = metas.get("og:description") ?? "";
  const parts = description.split(" · ");
  if (parts.length < 4) throw new Error(`Unexpected og:description: ${description}`);
  const [type, year, songs] = parts.slice(-3);
  const title = /^Listen to (.*) - (?:Album|Single|EP|Compilation) by .*$/s.exec(metas.get("og:title") ?? "")?.[1];
  const count = /^(\d+) songs?$/.exec(songs)?.[1];
  return {
    title: title ?? null,
    artist: parts.slice(0, -3).join(" · "),
    type,
    year,
    total_tracks: count ? Number(count) : null,
    release_date: metas.get("music:release_date") ?? null,
    cover: metas.get("og:image") ?? null,
  };
}

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? entity;
  });
}

// --- 3. One row per album -------------------------------------------------

export const CSV_COLUMNS = [
  "artist",
  "album",
  "year",
  "plays",
  "spotify",
  "cover",
  "type",
  "tracks_played",
  "total_tracks",
  "first_played",
  "last_played",
  "spotify_artist",
] as const;

export type Row = Record<(typeof CSV_COLUMNS)[number], string>;

// Edition notes in brackets, removed from titles: "(Remastered 2011)", "[Deluxe Edition]".
const EDITION_NOTE = /\s*[([][^)\]]*(master|re-mastered|mix|deluxe|edition|box set)[^)\]]*[)\]]/gi;

export function withoutEditionNote(title: string): string {
  return title.replace(EDITION_NOTE, "").trim() || title;
}

/**
 * One row per Spotify album: pairs resolving to the same album are merged
 * (plays added up), then albums already in the library are skipped, by link
 * or by the app's albumMatchKey (artist + title). Most played first.
 */
export function albumRows(kept: Pair[], resolved: Map<string, Resolved>, library: Album[]) {
  type Merged = Omit<Pair, "artist" | "album" | "sample_track"> & { album: SpotifyAlbum; names: Pair[] };
  const merged = new Map<string, Merged>();
  for (const pair of kept) {
    const r = resolved.get(pairKey(pair));
    if (r?.status !== "ok" || !r.album_id || !r.spotify_album) continue;
    const m = merged.get(r.album_id);
    if (!m) {
      const { plays, tracks_played, first_played, last_played } = pair;
      merged.set(r.album_id, { album: r.spotify_album, names: [pair], plays, tracks_played, first_played, last_played });
    } else {
      m.names.push(pair);
      m.plays += pair.plays;
      m.tracks_played = Math.max(m.tracks_played, pair.tracks_played);
      if (pair.first_played < m.first_played) m.first_played = pair.first_played;
      if (pair.last_played > m.last_played) m.last_played = pair.last_played;
    }
  }

  const links = new Set(library.map((a) => a.spotify));
  const keys = new Set(library.map((a) => albumMatchKey(a.artists[0] ?? "", a.title)));
  const rows: Row[] = [];
  let byLink = 0;
  let byKey = 0;
  for (const [id, m] of merged) {
    const a = m.album;
    // The app's convention for compilations.
    const artist = a.type === "compilation" || a.artist === VARIOUS_ARTISTS ? VARIOUS_ARTISTS : a.artist;
    const fullTitle = a.title ?? m.names[0].album;
    const title = withoutEditionNote(fullTitle);
    const names: [string, string][] = [[artist, title], [artist, fullTitle], ...m.names.map((n): [string, string] => [n.artist, n.album])];
    if (links.has(`spotify:album:${id}`)) {
      byLink++;
    } else if (names.some(([ar, t]) => keys.has(albumMatchKey(ar, t)))) {
      byKey++;
    } else {
      rows.push({
        artist,
        album: title,
        year: a.year,
        plays: String(m.plays),
        spotify: `https://open.spotify.com/album/${id}`,
        cover: a.cover ?? "",
        type: a.type,
        tracks_played: String(m.tracks_played),
        total_tracks: a.total_tracks === null ? "" : String(a.total_tracks),
        first_played: m.first_played,
        last_played: m.last_played,
        spotify_artist: a.artist,
      });
    }
  }
  rows.sort((a, b) => Number(b.plays) - Number(a.plays) || compare(a.artist, b.artist) || compare(a.album, b.album));
  return { rows, albums: merged.size, mergedAlbums: [...merged.values()].filter((m) => m.names.length > 1).length, byLink, byKey };
}

/** CSV text: a header row, then one line per row; fields with commas, quotes or line breaks are quoted. */
export function toCsv(rows: Row[]): string {
  const field = (value: string) => (/[",\r\n]|^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [CSV_COLUMNS.join(","), ...rows.map((row) => CSV_COLUMNS.map((c) => field(row[c] ?? "")).join(","))].join("\n") + "\n";
}

// --- 4. Into the library, for triage --------------------------------------

/**
 * The rows to add to the library, tagged "triage" (reviewed in the app's
 * Triage source). Skips albums already in the library, rows by `dropArtists`,
 * and duplicate editions (same artist and title: the most played is kept,
 * the others are linked from its notes). Listening stats go in `notes`.
 * `addedAt` is a second apart in play order, the most played the latest, so
 * Triage sorted by Date Added (newest first) lists them by plays.
 */
export function triageAlbums(
  rows: Record<string, string>[],
  library: Album[],
  { dropArtists = [] as string[], now = Date.now(), newId }: { dropArtists?: string[]; now?: number; newId: () => string },
) {
  const links = new Set(library.map((a) => a.spotify));
  const keys = new Set(library.map((a) => albumMatchKey(a.artists[0] ?? "", a.title)));
  const drop = new Set(dropArtists);
  const sorted = [...rows].sort((a, b) => Number(b.plays) - Number(a.plays));
  const byKey = new Map<string, Album>();
  const added: Album[] = [];
  const skipped = { inLibrary: 0, dropped: [] as Record<string, string>[], duplicates: [] as Record<string, string>[] };
  const thousands = (n: string) => Number(n).toLocaleString("en");
  for (const row of sorted) {
    const id = /^https:\/\/open\.spotify\.com\/album\/([A-Za-z0-9]{22})$/.exec(row.spotify ?? "")?.[1];
    if (!id) throw new Error(`Not a Spotify album link: ${row.spotify}`);
    const uri = `spotify:album:${id}`;
    if (links.has(uri) || keys.has(albumMatchKey(row.artist, row.album))) {
      skipped.inLibrary++;
      continue;
    }
    if (drop.has(row.artist) || drop.has(row.spotify_artist)) {
      skipped.dropped.push(row);
      continue;
    }
    // Compilations are told apart by Spotify's artist: "Greatest Hits" by two bands are two albums.
    const credited = row.spotify_artist || row.artist;
    const key = albumMatchKey(row.artist === VARIOUS_ARTISTS ? credited : row.artist, row.album);
    const kept = byKey.get(key);
    if (kept) {
      kept.notes += `\nOther edition: ${row.spotify} (${thousands(row.plays)} plays).`;
      skipped.duplicates.push(row);
      continue;
    }
    const notes = [
      `Spotify history: ${thousands(row.plays)} plays, ${row.tracks_played}/${row.total_tracks || "?"} tracks, ${row.first_played} to ${row.last_played}.`,
    ];
    if (row.artist === VARIOUS_ARTISTS && credited !== VARIOUS_ARTISTS) {
      notes.push(`Spotify lists it as a ${row.type} by ${credited}.`);
    }
    const album: Album = {
      id: newId(),
      title: row.album.trim(),
      artists: [row.artist.trim()],
      artistSort: null,
      year: /^\d{4}$/.test(row.year) ? Number(row.year) : null,
      genres: [],
      tags: [TRIAGE_TAG],
      rating: null,
      notes: notes.join("\n"),
      spotify: uri,
      cover: row.cover || null,
      addedAt: new Date(now - added.length * 1000).toISOString(),
    };
    byKey.set(key, album);
    added.push(album);
  }
  return { added, skipped };
}

function compare(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}
