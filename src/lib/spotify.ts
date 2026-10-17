// Spotify album links and the public oEmbed endpoint (no auth).

const ALBUM_ID = /^[A-Za-z0-9]{22}$/;

/**
 * Extracts the album id from a Spotify album link or URI, e.g.
 * "https://open.spotify.com/intl-fr/album/<id>?si=…" or "spotify:album:<id>".
 * Returns null for anything else.
 */
export function parseSpotifyAlbumId(input: string): string | null {
  const text = input.trim();
  const uri = /^spotify:album:([A-Za-z0-9]+)$/.exec(text);
  if (uri) return ALBUM_ID.test(uri[1]) ? uri[1] : null;

  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.hostname !== "open.spotify.com" && url.hostname !== "play.spotify.com") return null;
  // The album segment can be preceded by a locale ("intl-fr") or "embed".
  const segments = url.pathname.split("/").filter(Boolean);
  const i = segments.indexOf("album");
  const id = i >= 0 ? segments[i + 1] : undefined;
  return id && ALBUM_ID.test(id) ? id : null;
}

/**
 * Finds every Spotify album link in a block of text (one per line, or
 * separated by spaces or commas). Returns the album ids without duplicates,
 * in order, and the pieces that are not album links.
 */
export function parseSpotifyAlbumIds(text: string): { ids: string[]; invalid: string[] } {
  const ids: string[] = [];
  const invalid: string[] = [];
  for (const piece of text.split(/[\s,]+/).filter(Boolean)) {
    const id = parseSpotifyAlbumId(piece);
    if (id === null) invalid.push(piece);
    else if (!ids.includes(id)) ids.push(id);
  }
  return { ids, invalid };
}

export const spotifyUri = (id: string) => `spotify:album:${id}`;
export const spotifyWebUrl = (id: string) => `https://open.spotify.com/album/${id}`;

/** Swaps a Spotify cover URL for its 640px version (oEmbed returns 300px). */
export function largeSpotifyCover(url: string): string {
  return url.replace(/ab67616d0000(1e02|4851)/, "ab67616d0000b273");
}

export interface SpotifyAlbumInfo {
  title: string;
  cover: string | null;
}

export async function fetchSpotifyAlbumInfo(id: string, fetchFn: typeof fetch = fetch): Promise<SpotifyAlbumInfo> {
  const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyWebUrl(id))}`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`Spotify lookup failed: HTTP ${res.status}`);
  const data = (await res.json()) as { title?: unknown; thumbnail_url?: unknown };
  if (typeof data.title !== "string" || !data.title) throw new Error("Spotify lookup returned no title");
  return {
    title: data.title,
    cover: typeof data.thumbnail_url === "string" ? largeSpotifyCover(data.thumbnail_url) : null,
  };
}
