// Spotify playback through the Web API, for a signed-in session: what's
// playing on the active device, and play/pause/next/previous. Spotify
// doesn't push changes, so the state is polled while the page is visible,
// and refreshed right after each action.

import type { KeyValueStore } from "./spotify-auth.ts";
import { spotifyLog } from "./spotify-log.ts";
import { SpotifyError, type SpotifySession } from "./spotify-session.svelte.ts";

/** Polling interval while the page is visible. */
export const POLL_MS = 5000;
/** Spotify takes a moment to reflect an action in the player state. */
const SETTLE_MS = 400;
/** Storage key for the device FliTunes last played on, kept across reloads. */
const DEVICE_KEY = "album-library:spotify-device";

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

/** A device Spotify can play on (a computer, a phone, a speaker…). */
export interface Device {
  id: string;
  name: string;
  isActive: boolean;
  /** False when Spotify doesn't let the Web API control it. */
  usable: boolean;
}

/** Reads GET /me/player/devices. Devices without an id can't be controlled: they're left out. */
export function parseDevices(data: unknown): Device[] {
  const list = ((data ?? {}) as { devices?: { id?: string | null; name?: string; is_active?: boolean; is_restricted?: boolean }[] }).devices;
  return (list ?? []).flatMap((d) =>
    d.id ? [{ id: d.id, name: d.name ?? "Unknown device", isActive: d.is_active === true, usable: d.is_restricted !== true }] : [],
  );
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

/** Whether a command sent to a device failed because that device can't be reached: a 404, a 5xx, or a network error. */
function unreachable(e: unknown): boolean {
  if (e instanceof SpotifyError) return e.status === 404 || e.status >= 500;
  return e instanceof TypeError;
}

export class SpotifyPlayer {
  playback = $state<Playback | null>(null);
  error = $state<string | null>(null);

  #session: SpotifySession;
  #now: () => number;
  #store: KeyValueStore | null;
  /**
   * The device picked in FliTunes, or the last one that took a retried
   * command, for commands sent while none is active. Kept in `store`, so a
   * reload doesn't fall back to whichever device Spotify lists first.
   */
  #deviceId: string | null;
  #lastState: string | null = null;
  #lastPoll = 0;

  constructor(session: SpotifySession, now = Date.now, store: KeyValueStore | null = null) {
    this.#session = session;
    this.#now = now;
    this.#store = store;
    this.#deviceId = store?.getItem(DEVICE_KEY) ?? null;
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
      const playback = parsePlayback(await this.#session.api("/me/player"), this.#now());
      // Log what changed only, not every poll.
      const state = playback ? `${playback.isPlaying ? "playing" : "paused"} on ${playback.deviceName ?? "?"}: ${playback.track?.name ?? "no track"}` : "nothing playing";
      if (state !== this.#lastState) spotifyLog(`player: ${state}`);
      this.#lastState = state;
      this.playback = playback;
    } catch (e) {
      spotifyLog(`player: refresh failed: ${(e as Error).message}`);
      this.error = (e as Error).message;
    }
  }

  /**
   * Plays an album or playlist (a spotify: URI), optionally from one of its
   * tracks. Without an active device, plays on the chosen or first available one.
   */
  async play(contextUri: string, fromTrackUri?: string): Promise<void> {
    const body = JSON.stringify({ context_uri: contextUri, ...(fromTrackUri ? { offset: { uri: fromTrackUri } } : {}) });
    await this.#act(() => this.#command("/me/player/play", { method: "PUT", body }));
  }

  async togglePlay(): Promise<void> {
    const playback = this.playback;
    const playing = playback?.isPlaying;
    // Flip the button now; the refresh after the action confirms it.
    if (playback) {
      const now = this.#now();
      this.playback = { ...playback, isPlaying: !playing, progressMs: currentProgress(playback, now), fetchedAt: now };
    }
    await this.#act(() => (playing ? this.#pause() : this.#command("/me/player/play", { method: "PUT" })));
  }

  async next(): Promise<void> {
    await this.#act(() => this.#command("/me/player/next", { method: "POST" }));
  }

  async previous(): Promise<void> {
    await this.#act(() => this.#command("/me/player/previous", { method: "POST" }));
  }

  /** The devices Spotify can play on, or null (with the error set) if they can't be listed. */
  async loadDevices(): Promise<Device[] | null> {
    this.error = null;
    try {
      const devices = parseDevices(await this.#session.api("/me/player/devices"));
      spotifyLog("devices", devices);
      return devices;
    } catch (e) {
      this.error = (e as Error).message;
      return null;
    }
  }

  /** Moves playback to a device, which then also gets the commands sent without an active device. */
  async selectDevice(id: string): Promise<void> {
    const body = JSON.stringify({ device_ids: [id], play: this.playback?.isPlaying ?? false });
    // Remembered once Spotify takes it, so a device asleep isn't tried first from then on.
    if (await this.#act(() => this.#session.api("/me/player", { method: "PUT", body }))) this.#rememberDevice(id);
  }

  /** Polls while the page is visible. Returns a function that stops it. */
  start(): () => void {
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      // A long gap means the page was hidden or the computer slept: Spotify devices may have gone idle meanwhile.
      if (this.#lastPoll && now - this.#lastPoll > 2 * POLL_MS) spotifyLog(`polling again after ${Math.round((now - this.#lastPoll) / 1000)} s`);
      this.#lastPoll = now;
      this.refresh();
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }

  /** Runs an action, then refreshes. Returns whether it succeeded (on failure, the error is set). */
  async #act(action: () => Promise<unknown>): Promise<boolean> {
    this.error = null;
    try {
      await action();
    } catch (e) {
      spotifyLog(`action failed: ${(e as Error).message}`);
      // Undo any optimistic change, keeping the action's error.
      await this.refresh();
      this.error = (e as Error).message;
      return false;
    }
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    await this.refresh();
    return true;
  }

  /** Spotify answers 404 to a pause when nothing is playing anywhere: there is nothing to pause, and no device to wake. */
  async #pause(): Promise<unknown> {
    try {
      return await this.#session.api("/me/player/pause", { method: "PUT" });
    } catch (e) {
      if (!(e instanceof SpotifyError && e.status === 404)) throw e;
      spotifyLog("404 on PUT /me/player/pause: nothing playing, nothing to pause");
      return null;
    }
  }

  /**
   * Sends a player command. Spotify answers 404 when no device is active, and
   * also when the active one has gone idle ("Not found."): the command is then
   * sent again to a device by its id, which wakes it up. Spotify still lists
   * devices that can't be woken (a computer asleep, an app closed): those
   * answer 404 or 5xx, or don't answer, and the next device is tried. The
   * device that takes a play is remembered for the next time.
   */
  async #command(path: string, init: RequestInit): Promise<unknown> {
    try {
      return await this.#session.api(path, init);
    } catch (e) {
      if (!(e instanceof SpotifyError && e.status === 404)) throw e;
      const devices = await this.#targetDevices();
      if (devices.length === 0) {
        spotifyLog(`404 on ${init.method} ${path}: no device to send it to`);
        throw new Error("Open Spotify on one of your devices first, then try again.");
      }
      for (const device of devices) {
        spotifyLog(`404 on ${init.method} ${path}: sending it again to ${device.name} (${device.id})`);
        try {
          const result = await this.#session.api(`${path}?device_id=${encodeURIComponent(device.id)}`, init);
          if (path === "/me/player/play") this.#rememberDevice(device.id);
          return result;
        } catch (e) {
          if (!unreachable(e)) throw e;
        }
      }
      const names = devices.map((d) => d.name).join(", ");
      throw new Error(`Spotify couldn't reach ${names}. Open Spotify on the device you want, or choose one in the device menu.`);
    }
  }

  /** The usable devices, in the order to try them: the chosen one if Spotify still lists it, the active one, then the others. */
  async #targetDevices(): Promise<Device[]> {
    const all = parseDevices(await this.#session.api("/me/player/devices"));
    spotifyLog("devices", all);
    const rank = (d: Device) => (d.id === this.#deviceId ? 0 : d.isActive ? 1 : 2);
    // sort() is stable: the others keep Spotify's order.
    return all.filter((d) => d.usable).sort((a, b) => rank(a) - rank(b));
  }

  #rememberDevice(id: string): void {
    if (id === this.#deviceId) return;
    this.#deviceId = id;
    this.#store?.setItem(DEVICE_KEY, id);
  }
}
