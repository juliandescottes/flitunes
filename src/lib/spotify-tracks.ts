// Album track lists from the Spotify Web API, for the album details view.
// Shown live and cached for the session only: never saved to the library.

import type { SpotifySession } from "./spotify-session.svelte.ts";

export interface Track {
  uri: string;
  disc: number;
  number: number;
  name: string;
  artists: string[];
  durationMs: number;
}

interface TracksPage {
  items?: {
    uri?: string;
    disc_number?: number;
    track_number?: number;
    name?: string;
    duration_ms?: number;
    artists?: { name: string }[];
  }[];
  next?: string | null;
}

/** Reads one page of GET /albums/{id}/tracks. */
export function parseTracks(page: unknown): { tracks: Track[]; next: string | null } {
  const p = (page ?? {}) as TracksPage;
  const tracks = (p.items ?? []).flatMap((t) =>
    t.uri
      ? [
          {
            uri: t.uri,
            disc: t.disc_number ?? 1,
            number: t.track_number ?? 0,
            name: t.name ?? "",
            artists: (t.artists ?? []).map((a) => a.name),
            durationMs: t.duration_ms ?? 0,
          },
        ]
      : [],
  );
  return { tracks, next: p.next ?? null };
}

/** Whether a track list can be fetched for this link (albums only for now). */
export function hasTrackList(spotifyUri: string | null): boolean {
  return spotifyUri?.startsWith("spotify:album:") ?? false;
}

const cache = new Map<string, Promise<Track[]>>();

/** The tracks of an album (a spotify:album: URI), cached for the session. */
export function albumTracks(session: SpotifySession, albumUri: string): Promise<Track[]> {
  let tracks = cache.get(albumUri);
  if (!tracks) {
    tracks = fetchAll(session, albumUri);
    // Don't keep a failure: the next attempt fetches again.
    tracks.catch(() => cache.delete(albumUri));
    cache.set(albumUri, tracks);
  }
  return tracks;
}

async function fetchAll(session: SpotifySession, albumUri: string): Promise<Track[]> {
  const id = albumUri.split(":")[2];
  const tracks: Track[] = [];
  let path: string | null = `/albums/${encodeURIComponent(id)}/tracks?limit=50`;
  while (path) {
    const page = parseTracks(await session.api(path));
    tracks.push(...page.tracks);
    // `next` is a full URL: keep the part after the API root.
    path = page.next ? page.next.replace(/^https:\/\/api\.spotify\.com\/v1/, "") : null;
  }
  return tracks;
}

/** The year from a Spotify release date ("1959-08-17", "1959-08" or "1959"). */
export function releaseYear(album: unknown): number | null {
  const date = (album as { release_date?: unknown } | null)?.release_date;
  const year = typeof date === "string" ? Number.parseInt(date.slice(0, 4), 10) : NaN;
  return Number.isFinite(year) ? year : null;
}

const years = new Map<string, Promise<number | null>>();

/**
 * An album's release year from Spotify (a spotify:album: URI), cached for the
 * session: the fallback when the library has no year. Null if it fails.
 */
export function albumYear(session: SpotifySession, albumUri: string): Promise<number | null> {
  let year = years.get(albumUri);
  if (!year) {
    const id = albumUri.split(":")[2];
    year = session.api(`/albums/${encodeURIComponent(id)}`).then(releaseYear, () => {
      years.delete(albumUri);
      return null;
    });
    years.set(albumUri, year);
  }
  return year;
}

/**
 * The artists shown for a track: the album's curated artists when the track
 * is only by them (or Spotify lists no one), else Spotify's own (features,
 * compilations).
 */
export function trackArtists(track: Track, albumArtists: string[]): string[] {
  const curated = new Set(albumArtists);
  return track.artists.every((a) => curated.has(a)) ? albumArtists : track.artists;
}
