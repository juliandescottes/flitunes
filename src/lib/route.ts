// What the main view shows, as the page address, so the browser's Back and
// Forward walk through it. It lives in the hash (`#/playlist/vinyl?genre=jazz`):
// the query string stays free for Spotify's sign-in redirect, and GitHub Pages
// serves the page whatever the hash.
//
// View mode, sort and the link filter are preferences, not places, so they
// stay out of it. So does the selection.

import type { Source } from "./browse.ts";

export type Route = {
  source: Source;
  genre: string | null;
  artist: string | null;
  /** The title picked in the Albums column. */
  album: string | null;
  search: string;
  /** The album whose tracks are shown. */
  tracks: string | null;
};

export const HOME: Route = { source: { kind: "music" }, genre: null, artist: null, album: null, search: "", tracks: null };

/** The hash for a route: "" for the plain library, so the address stays clean. */
export function routeToHash(route: Route): string {
  const params = new URLSearchParams();
  if (route.genre !== null) params.set("genre", route.genre);
  if (route.artist !== null) params.set("artist", route.artist);
  if (route.album !== null) params.set("album", route.album);
  if (route.search !== "") params.set("q", route.search);
  if (route.tracks !== null) params.set("tracks", route.tracks);
  const query = params.toString();
  const path =
    route.source.kind === "playlist" ? `/playlist/${encodeURIComponent(route.source.tag)}` : `/${route.source.kind}`;
  if (path === "/music" && query === "") return "";
  return `#${path}${query ? `?${query}` : ""}`;
}

/** The route for a hash. Anything it doesn't recognise reads as the plain library. */
export function parseHash(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#/, "").split("?", 2);
  const params = new URLSearchParams(query);
  return {
    source: parseSource(path),
    genre: params.get("genre"),
    artist: params.get("artist"),
    album: params.get("album"),
    search: params.get("q") ?? "",
    tracks: params.get("tracks"),
  };
}

function parseSource(path: string): Source {
  if (path === "/recent") return { kind: "recent" };
  const playlist = /^\/playlist\/(.+)$/.exec(path);
  if (playlist) {
    try {
      return { kind: "playlist", tag: decodeURIComponent(playlist[1]) };
    } catch {
      // A malformed escape: fall back to the library.
    }
  }
  return { kind: "music" };
}

/**
 * Whether going from one route to the next should replace the current
 * history entry rather than add one: typing in the search field changes the
 * route on every key, and Back should skip the whole search at once.
 */
export function replacesEntry(from: Route, to: Route): boolean {
  return from.search !== "" && routeToHash({ ...from, search: to.search }) === routeToHash(to);
}
