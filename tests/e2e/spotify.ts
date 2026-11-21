// A fake Spotify for the e2e tests: the Web API (account, player, devices,
// album tracks) and the sign-in endpoints, so no real account is reached.
// Its player behaves like Spotify's enough for FliTunes: commands change
// what GET /me/player returns.

import type { Page } from "@playwright/test";

const TOKENS_KEY = "album-library:spotify-tokens";

export interface FakeTrack {
  name: string;
  seconds: number;
  /** The track's artists, when they aren't the album's. */
  artists?: string[];
  disc?: number;
}

export interface FakeAlbum {
  name: string;
  artists: string[];
  tracks: FakeTrack[];
  /** "1959-08-17", for albums without a year in the library. */
  releaseDate?: string;
}

export interface FakeDevice {
  id: string;
  name: string;
  isActive: boolean;
  /** Spotify doesn't let the Web API control it. */
  restricted?: boolean;
}

export class FakeSpotify {
  user = "Test Listener";
  /** Albums by Spotify id. */
  albums: Record<string, FakeAlbum> = {};
  devices: FakeDevice[] = [{ id: "laptop", name: "Laptop", isActive: true }];
  /** What plays: an album (by id) and the index of its track. */
  playing: { albumId: string; contextUri: string; track: number; isPlaying: boolean } | null = null;
  /** Commands received, as "PUT /me/player/play" with their body. */
  commands: { call: string; body: unknown }[] = [];
  /** Spotify no longer accepts the session. */
  revoked = false;
  /** Track lists that fail to load, by album id. */
  failingTracks = new Set<string>();

  constructor(albums: Record<string, FakeAlbum> = {}) {
    this.albums = albums;
  }

  async install(page: Page) {
    await page.route("https://api.spotify.com/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/v1/, "");
      const method = request.method();
      const body = request.postData() ? JSON.parse(request.postData()!) : null;
      if (this.revoked) return route.fulfill({ status: 401, json: { error: { status: 401, message: "The access token expired" } } });
      if (path.startsWith("/me/player") && method !== "GET") this.commands.push({ call: `${method} ${path}${url.search}`, body });

      const empty = () => route.fulfill({ status: 204 });
      const noDevice = () => route.fulfill({ status: 404, json: { error: { status: 404, message: "Player command failed: No active device found" } } });
      const target = url.searchParams.get("device_id");
      if (target) {
        if (!this.devices.some((d) => d.id === target)) return noDevice();
        this.devices = this.devices.map((d) => ({ ...d, isActive: d.id === target }));
      }
      const active = this.devices.some((d) => d.isActive);

      if (path === "/me" && method === "GET") return route.fulfill({ json: { id: "test-listener", display_name: this.user } });
      if (path === "/me/player" && method === "GET") return this.playing ? route.fulfill({ json: this.#playerState() }) : empty();
      if (path === "/me/player/devices" && method === "GET") {
        return route.fulfill({
          json: { devices: this.devices.map((d) => ({ id: d.id, name: d.name, is_active: d.isActive, is_restricted: d.restricted === true, type: "Computer" })) },
        });
      }
      if (path === "/me/player" && method === "PUT") {
        const id = (body as { device_ids: string[] }).device_ids[0];
        this.devices = this.devices.map((d) => ({ ...d, isActive: d.id === id }));
        return empty();
      }
      if (path === "/me/player/play" && method === "PUT") {
        if (!active) return noDevice();
        const { context_uri, offset } = (body ?? {}) as { context_uri?: string; offset?: { uri: string } };
        if (context_uri) {
          const albumId = context_uri.split(":")[2];
          const tracks = this.albums[albumId]?.tracks ?? [];
          const index = offset ? tracks.findIndex((_, i) => trackUri(albumId, i) === offset.uri) : 0;
          this.playing = { albumId, contextUri: context_uri, track: Math.max(0, index), isPlaying: true };
        } else if (this.playing) {
          this.playing.isPlaying = true;
        }
        return empty();
      }
      if (path === "/me/player/pause" && method === "PUT") {
        if (!active) return noDevice();
        if (this.playing) this.playing.isPlaying = false;
        return empty();
      }
      if ((path === "/me/player/next" || path === "/me/player/previous") && method === "POST") {
        if (!active) return noDevice();
        if (this.playing) {
          const count = this.albums[this.playing.albumId]?.tracks.length ?? 1;
          const step = path.endsWith("next") ? 1 : -1;
          this.playing.track = Math.max(0, Math.min(count - 1, this.playing.track + step));
        }
        return empty();
      }
      const tracks = /^\/albums\/([^/]+)\/tracks$/.exec(path);
      if (tracks && method === "GET") {
        if (this.failingTracks.has(tracks[1])) return route.fulfill({ status: 500, json: { error: { status: 500, message: "Server error" } } });
        const album = this.albums[tracks[1]];
        return route.fulfill({ json: { items: album ? album.tracks.map((t, i) => this.#track(tracks[1], i)) : [], next: null } });
      }
      const albumInfo = /^\/albums\/([^/]+)$/.exec(path);
      if (albumInfo && method === "GET") return route.fulfill({ json: { release_date: this.albums[albumInfo[1]]?.releaseDate ?? null } });
      await route.fulfill({ status: 404, json: { error: { status: 404, message: "Not found." } } });
    });
  }

  #track(albumId: string, index: number) {
    const album = this.albums[albumId];
    const track = album.tracks[index];
    return {
      type: "track",
      uri: trackUri(albumId, index),
      name: track.name,
      duration_ms: track.seconds * 1000,
      disc_number: track.disc ?? 1,
      // Numbered from 1 on each disc.
      track_number: album.tracks.slice(0, index).filter((t) => (t.disc ?? 1) === (track.disc ?? 1)).length + 1,
      artists: (track.artists ?? album.artists).map((name) => ({ name })),
      album: { name: album.name, uri: `spotify:album:${albumId}` },
    };
  }

  #playerState() {
    const playing = this.playing!;
    return {
      is_playing: playing.isPlaying,
      progress_ms: 0,
      device: { name: this.devices.find((d) => d.isActive)?.name ?? null },
      context: { uri: playing.contextUri },
      item: this.albums[playing.albumId] ? this.#track(playing.albumId, playing.track) : null,
    };
  }
}

/** The URI of an album's track in the fake. */
export function trackUri(albumId: string, index: number): string {
  return `spotify:track:${albumId.slice(0, 12)}track${String(index).padStart(5, "0")}`;
}

/**
 * Signs in to the fake Spotify before the app opens: tokens in localStorage,
 * as a sign-in would have left them (only on the first load, so signing out
 * lasts across reloads).
 */
export async function signInToSpotify(page: Page, spotify: FakeSpotify) {
  await spotify.install(page);
  await page.addInitScript((key) => {
    if (sessionStorage.getItem("e2e:signed-in")) return;
    sessionStorage.setItem("e2e:signed-in", "yes");
    localStorage.setItem(key, JSON.stringify({ accessToken: "fake-access", refreshToken: "fake-refresh", expiresAt: Date.now() + 3600_000 }));
  }, TOKENS_KEY);
}
