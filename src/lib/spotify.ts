// Spotify album and playlist links, and the public oEmbed endpoint (no auth).
// An album usually links to a Spotify album; a playlist link is the fallback
// for albums Spotify doesn't have as such.

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const KINDS = ["album", "playlist"];

/**
 * Turns a Spotify album or playlist link into its URI, e.g.
 * "https://open.spotify.com/intl-fr/album/<id>?si=…" into "spotify:album:<id>".
 * URIs are accepted too. Returns null for anything else.
 */
export function parseSpotifyLink(input: string): string | null {
  const text = input.trim();
  const uri = /^spotify:([a-z]+):([A-Za-z0-9]+)$/.exec(text);
  if (uri) return KINDS.includes(uri[1]) && SPOTIFY_ID.test(uri[2]) ? text : null;

  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.hostname !== "open.spotify.com" && url.hostname !== "play.spotify.com") return null;
  // The kind segment can be preceded by a locale ("intl-fr") or "embed".
  const segments = url.pathname.split("/").filter(Boolean);
  const i = segments.findIndex((s) => KINDS.includes(s));
  const id = i >= 0 ? segments[i + 1] : undefined;
  return id && SPOTIFY_ID.test(id) ? `spotify:${segments[i]}:${id}` : null;
}

/**
 * Finds every Spotify album or playlist link in a block of text (one per
 * line, or separated by spaces or commas). Returns their URIs without
 * duplicates, in order, and the pieces that are not such links.
 */
export function parseSpotifyLinks(text: string): { uris: string[]; invalid: string[] } {
  const uris: string[] = [];
  const invalid: string[] = [];
  for (const piece of text.split(/[\s,]+/).filter(Boolean)) {
    const uri = parseSpotifyLink(piece);
    if (uri === null) invalid.push(piece);
    else if (!uris.includes(uri)) uris.push(uri);
  }
  return { uris, invalid };
}

/** "spotify:album:<id>" → "https://open.spotify.com/album/<id>". */
export const spotifyWebUrl = (uri: string) => `https://open.spotify.com/${uri.split(":").slice(1).join("/")}`;

/** Swaps a Spotify cover URL for its 640px version (oEmbed returns 300px). */
export function largeSpotifyCover(url: string): string {
  return url.replace(/ab67616d0000(1e02|4851)/, "ab67616d0000b273");
}

export interface SpotifyInfo {
  title: string;
  cover: string | null;
}

/** Title and cover of an album or playlist URI. */
export async function fetchSpotifyInfo(uri: string, fetchFn: typeof fetch = fetch): Promise<SpotifyInfo> {
  const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyWebUrl(uri))}`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`Spotify lookup failed: HTTP ${res.status}`);
  const data = (await res.json()) as { title?: unknown; thumbnail_url?: unknown };
  if (typeof data.title !== "string" || !data.title) throw new Error("Spotify lookup returned no title");
  return {
    title: data.title,
    cover: typeof data.thumbnail_url === "string" ? largeSpotifyCover(data.thumbnail_url) : null,
  };
}
