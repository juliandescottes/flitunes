// Spotify playback through the Web API, for a signed-in session: what's
// playing on the active device, and play/pause/next/previous. Spotify
// doesn't push changes, so the state is polled while the page is visible,
// and refreshed right after each action.

import type { SpotifySession } from "./spotify-session.svelte.ts";

/** Polling interval while the page is visible. */
export const POLL_MS = 5000;
/** Spotify takes a moment to reflect an action in the player state. */
const SETTLE_MS = 400;

export interface Playback {
  isPlaying: boolean;
  /** The playing track, or null for an ad, a podcast episode or nothing loaded. */
  track: {
    uri: string;
    name: string;
    artists: string[];
    albumName: string;
    albumUri: string;
    durationMs: number;
  } | null;
  /** What was played (an album or a playlist URI), e.g. the album passed to play(). */
  contextUri: string | null;
  /** Position when the state was fetched. */
  progressMs: number;
  /** When the state was fetched (ms since the epoch). */
  fetchedAt: number;
  deviceName: string | null;
}

interface PlayerResponse {
  is_playing?: boolean;
  progress_ms?: number | null;
  device?: { name?: string } | null;
  context?: { uri?: string } | null;
  item?: {
    type?: string;
    uri?: string;
    name?: string;
    duration_ms?: number;
    artists?: { name: string }[];
    album?: { name?: string; uri?: string };
  } | null;
}

/** Reads GET /me/player (null when nothing is playing anywhere). */
export function parsePlayback(data: unknown, now: number): Playback | null {
  if (!data || typeof data !== "object") return null;
  const d = data as PlayerResponse;
  const item = d.item;
  const track =
    item && item.type === "track" && item.uri
      ? {
          uri: item.uri,
          name: item.name ?? "",
          artists: (item.artists ?? []).map((a) => a.name),
          albumName: item.album?.name ?? "",
          albumUri: item.album?.uri ?? "",
          durationMs: item.duration_ms ?? 0,
        }
      : null;
  return {
    isPlaying: d.is_playing === true,
    track,
    contextUri: d.context?.uri ?? null,
    progressMs: d.progress_ms ?? 0,
    fetchedAt: now,
    deviceName: d.device?.name ?? null,
  };
}

/** The current position: the fetched one, plus the time since if playing. */
export function currentProgress(playback: Playback, now: number): number {
  const elapsed = playback.isPlaying ? now - playback.fetchedAt : 0;
  return Math.min(playback.progressMs + elapsed, playback.track?.durationMs ?? Infinity);
}

/** "m:ss" for a duration in milliseconds. */
export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export class SpotifyPlayer {
  playback = $state<Playback | null>(null);
  error = $state<string | null>(null);

  #session: SpotifySession;
  #now: () => number;

  constructor(session: SpotifySession, now = Date.now) {
    this.#session = session;
    this.#now = now;
  }

  get active(): boolean {
    return this.#session.status === "signed-in";
  }

  async refresh(): Promise<void> {
    if (!this.active) {
      this.playback = null;
      return;
    }
    try {
      this.playback = parsePlayback(await this.#session.api("/me/player"), this.#now());
    } catch (e) {
      this.error = (e as Error).message;
    }
  }

  /**
   * Plays an album or playlist (a spotify: URI), optionally from one of its
   * tracks. Without an active device, plays on the first available one.
   */
  async play(contextUri: string, fromTrackUri?: string): Promise<void> {
    const body = JSON.stringify({ context_uri: contextUri, ...(fromTrackUri ? { offset: { uri: fromTrackUri } } : {}) });
    await this.#act(async () => {
      try {
        await this.#session.api("/me/player/play", { method: "PUT", body });
      } catch (e) {
        if (!/no active device/i.test((e as Error).message)) throw e;
        const device = await this.#firstDevice();
        if (!device) throw new Error("Open Spotify on one of your devices first, then try again.");
        await this.#session.api(`/me/player/play?device_id=${encodeURIComponent(device)}`, { method: "PUT", body });
      }
    });
  }

  async togglePlay(): Promise<void> {
    const playback = this.playback;
    const playing = playback?.isPlaying;
    // Flip the button now; the refresh after the action confirms it.
    if (playback) {
      const now = this.#now();
      this.playback = { ...playback, isPlaying: !playing, progressMs: currentProgress(playback, now), fetchedAt: now };
    }
    await this.#act(() => this.#session.api(playing ? "/me/player/pause" : "/me/player/play", { method: "PUT" }));
  }

  async next(): Promise<void> {
    await this.#act(() => this.#session.api("/me/player/next", { method: "POST" }));
  }

  async previous(): Promise<void> {
    await this.#act(() => this.#session.api("/me/player/previous", { method: "POST" }));
  }

  /** Polls while the page is visible. Returns a function that stops it. */
  start(): () => void {
    const poll = () => {
      if (document.visibilityState === "visible") this.refresh();
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }

  async #act(action: () => Promise<unknown>): Promise<void> {
    this.error = null;
    try {
      await action();
    } catch (e) {
      // Undo any optimistic change, keeping the action's error.
      await this.refresh();
      this.error = (e as Error).message;
      return;
    }
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    await this.refresh();
  }

  async #firstDevice(): Promise<string | null> {
    const data = (await this.#session.api("/me/player/devices")) as { devices?: { id: string | null; is_restricted?: boolean }[] } | null;
    return data?.devices?.find((d) => d.id && !d.is_restricted)?.id ?? null;
  }
}
