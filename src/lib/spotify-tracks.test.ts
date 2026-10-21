import { describe, expect, it } from "vitest";
import type { SpotifySession } from "./spotify-session.svelte.ts";
import { albumTracks, albumYear, hasTrackList, parseTracks, releaseYear, trackArtists, type Track } from "./spotify-tracks.ts";

const item = (n: number) => ({
  uri: `spotify:track:t${n}`,
  disc_number: 1,
  track_number: n,
  name: `Track ${n}`,
  duration_ms: 1000 * n,
  artists: [{ name: "Air" }],
});

describe("parseTracks", () => {
  it("reads a page of tracks and the next page", () => {
    expect(parseTracks({ items: [item(1)], next: "https://api.spotify.com/v1/albums/a/tracks?offset=50" })).toEqual({
      tracks: [{ uri: "spotify:track:t1", disc: 1, number: 1, name: "Track 1", artists: ["Air"], durationMs: 1000 }],
      next: "https://api.spotify.com/v1/albums/a/tracks?offset=50",
    });
    expect(parseTracks({ items: [{ name: "local file, no uri" }] })).toEqual({ tracks: [], next: null });
  });
});

describe("hasTrackList", () => {
  it("is true for albums only", () => {
    expect(hasTrackList("spotify:album:x")).toBe(true);
    expect(hasTrackList("spotify:playlist:x")).toBe(false);
    expect(hasTrackList(null)).toBe(false);
  });
});

describe("albumTracks", () => {
  it("follows the pages and caches the result", async () => {
    const paths: string[] = [];
    const session = {
      async api(path: string) {
        paths.push(path);
        return path.includes("offset=50")
          ? { items: [item(51)], next: null }
          : { items: Array.from({ length: 50 }, (_, i) => item(i + 1)), next: "https://api.spotify.com/v1/albums/a1/tracks?offset=50&limit=50" };
      },
    } as unknown as SpotifySession;
    const tracks = await albumTracks(session, "spotify:album:a1");
    expect(tracks).toHaveLength(51);
    expect(paths).toEqual(["/albums/a1/tracks?limit=50", "/albums/a1/tracks?offset=50&limit=50"]);
    await albumTracks(session, "spotify:album:a1");
    expect(paths).toHaveLength(2);
  });

  it("fetches again after a failure", async () => {
    let fail = true;
    const session = {
      async api() {
        if (fail) throw new Error("Spotify: rate limited");
        return { items: [item(1)], next: null };
      },
    } as unknown as SpotifySession;
    await expect(albumTracks(session, "spotify:album:a2")).rejects.toThrow("rate limited");
    fail = false;
    expect(await albumTracks(session, "spotify:album:a2")).toHaveLength(1);
  });
});

describe("releaseYear", () => {
  it("reads the year at any precision", () => {
    expect(releaseYear({ release_date: "1959-08-17" })).toBe(1959);
    expect(releaseYear({ release_date: "1971-03" })).toBe(1971);
    expect(releaseYear({ release_date: "1999" })).toBe(1999);
    expect(releaseYear({})).toBeNull();
    expect(releaseYear(null)).toBeNull();
  });
});

describe("albumYear", () => {
  it("is cached, and null after a failure", async () => {
    let calls = 0;
    const ok = { async api() { calls++; return { release_date: "1998-01-16" }; } } as unknown as SpotifySession;
    expect(await albumYear(ok, "spotify:album:y1")).toBe(1998);
    expect(await albumYear(ok, "spotify:album:y1")).toBe(1998);
    expect(calls).toBe(1);
    const failing = { async api() { throw new Error("Spotify: HTTP 403"); } } as unknown as SpotifySession;
    expect(await albumYear(failing, "spotify:album:y2")).toBeNull();
  });
});

describe("trackArtists", () => {
  const track = (artists: string[]): Track => ({ uri: "spotify:track:t", disc: 1, number: 1, name: "T", artists, durationMs: 0 });

  it("uses the curated artists when the track is only by them", () => {
    expect(trackArtists(track(["Air"]), ["Air"])).toEqual(["Air"]);
    expect(trackArtists(track([]), ["Air"])).toEqual(["Air"]);
  });

  it("uses Spotify's artists for features and compilations", () => {
    expect(trackArtists(track(["Air", "Beth Hirsch"]), ["Air"])).toEqual(["Air", "Beth Hirsch"]);
    expect(trackArtists(track(["Daft Punk"]), ["Various Artists"])).toEqual(["Daft Punk"]);
  });
});
