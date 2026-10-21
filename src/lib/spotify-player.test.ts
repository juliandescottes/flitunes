import { describe, expect, it } from "vitest";
import { currentProgress, formatTime, parseDevices, parsePlayback, SpotifyPlayer } from "./spotify-player.svelte.ts";
import { SpotifyError, type SpotifySession } from "./spotify-session.svelte.ts";

const playing = {
  is_playing: true,
  progress_ms: 61_000,
  device: { name: "MacBook" },
  context: { uri: "spotify:album:a1" },
  item: {
    type: "track",
    uri: "spotify:track:t1",
    name: "Moon Safari",
    duration_ms: 200_000,
    artists: [{ name: "Air" }],
    album: { name: "Moon Safari", uri: "spotify:album:a1" },
  },
};

describe("parsePlayback", () => {
  it("reads the playing track", () => {
    expect(parsePlayback(playing, 1000)).toEqual({
      isPlaying: true,
      track: {
        uri: "spotify:track:t1",
        name: "Moon Safari",
        artists: ["Air"],
        albumName: "Moon Safari",
        albumUri: "spotify:album:a1",
        durationMs: 200_000,
      },
      contextUri: "spotify:album:a1",
      progressMs: 61_000,
      fetchedAt: 1000,
      deviceName: "MacBook",
    });
  });

  it("is null when nothing plays, and has no track for an episode", () => {
    expect(parsePlayback(null, 0)).toBeNull();
    expect(parsePlayback({ is_playing: true, item: { type: "episode", uri: "spotify:episode:e" } }, 0)?.track).toBeNull();
  });
});

describe("parseDevices", () => {
  it("reads the devices that have an id", () => {
    expect(
      parseDevices({
        devices: [
          { id: "mac", name: "MacBook", is_active: true },
          { id: "tv", name: "TV", is_restricted: true },
          { id: null, name: "Car" },
        ],
      }),
    ).toEqual([
      { id: "mac", name: "MacBook", isActive: true, usable: true },
      { id: "tv", name: "TV", isActive: false, usable: false },
    ]);
    expect(parseDevices(null)).toEqual([]);
  });
});

describe("currentProgress", () => {
  it("advances while playing, up to the track's end", () => {
    const p = parsePlayback(playing, 1000)!;
    expect(currentProgress(p, 3000)).toBe(63_000);
    expect(currentProgress(p, 1_000_000)).toBe(200_000);
    expect(currentProgress({ ...p, isPlaying: false }, 3000)).toBe(61_000);
  });
});

describe("formatTime", () => {
  it("formats m:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(61_900)).toBe("1:01");
    expect(formatTime(3_600_000)).toBe("60:00");
  });
});

/** A signed-in session whose api() answers from `routes` and records the calls. */
function session(routes: Record<string, (init?: RequestInit) => unknown>) {
  const calls: { path: string; init?: RequestInit }[] = [];
  const fake = {
    status: "signed-in",
    async api(path: string, init?: RequestInit) {
      calls.push({ path, init });
      const route = routes[`${init?.method ?? "GET"} ${path}`];
      if (!route) throw new Error(`Spotify: unexpected ${path}`);
      return route(init);
    },
  };
  return { session: fake as unknown as SpotifySession, calls };
}

describe("SpotifyPlayer", () => {
  it("plays an album from a track, then refreshes", async () => {
    const { session: s, calls } = session({ "PUT /me/player/play": () => null, "GET /me/player": () => playing });
    const player = new SpotifyPlayer(s, () => 5);
    await player.play("spotify:album:a1", "spotify:track:t1");
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({
      context_uri: "spotify:album:a1",
      offset: { uri: "spotify:track:t1" },
    });
    expect(player.playback?.track?.name).toBe("Moon Safari");
    expect(player.error).toBeNull();
  });

  it("plays on the first device when none is active", async () => {
    let attempts = 0;
    const { session: s, calls } = session({
      "PUT /me/player/play": () => {
        if (attempts++ === 0) throw new SpotifyError(404, "Spotify: Player command failed: No active device found");
        return null;
      },
      "GET /me/player/devices": () => ({ devices: [{ id: null }, { id: "tv", is_restricted: true }, { id: "phone 1" }] }),
      "PUT /me/player/play?device_id=phone%201": () => null,
      "GET /me/player": () => playing,
    });
    await new SpotifyPlayer(s).play("spotify:album:a1");
    expect(calls.map((c) => c.path)).toContain("/me/player/play?device_id=phone%201");
  });

  it("explains what to do when there is no device at all", async () => {
    const { session: s } = session({
      "PUT /me/player/play": () => {
        throw new SpotifyError(404, "Spotify: No active device found");
      },
      "GET /me/player/devices": () => ({ devices: [] }),
    });
    const player = new SpotifyPlayer(s);
    await player.play("spotify:album:a1");
    expect(player.error).toContain("Open Spotify");
  });

  it("pauses when playing and resumes when paused", async () => {
    const { session: s, calls } = session({
      "PUT /me/player/pause": () => null,
      "PUT /me/player/play": () => null,
      "GET /me/player": () => ({ ...playing, is_playing: false }),
    });
    const player = new SpotifyPlayer(s);
    player.playback = parsePlayback(playing, 0);
    const done = player.togglePlay();
    // The button flips right away.
    expect(player.playback?.isPlaying).toBe(false);
    await done;
    expect(calls[0].path).toBe("/me/player/pause");
    await player.togglePlay();
    expect(calls.at(-2)!.path).toBe("/me/player/play");
  });

  it("sends a command again to the active device when it has gone idle", async () => {
    const { session: s, calls } = session({
      "POST /me/player/next": () => {
        throw new SpotifyError(404, "Spotify: Not found.");
      },
      "GET /me/player/devices": () => ({ devices: [{ id: "phone" }, { id: "mac", is_active: true }] }),
      "POST /me/player/next?device_id=mac": () => null,
      "GET /me/player": () => playing,
    });
    const player = new SpotifyPlayer(s);
    await player.next();
    expect(calls.map((c) => c.path)).toContain("/me/player/next?device_id=mac");
    expect(player.error).toBeNull();
  });

  it("doesn't retry other errors", async () => {
    const { session: s, calls } = session({
      "POST /me/player/next": () => {
        throw new SpotifyError(403, "Spotify: Restriction violated");
      },
      "GET /me/player": () => playing,
    });
    const player = new SpotifyPlayer(s);
    await player.next();
    expect(calls.map((c) => c.path)).not.toContain("/me/player/devices");
    expect(player.error).toContain("Restriction");
  });

  it("moves playback to the chosen device, which then gets the commands without an active device", async () => {
    let active = true;
    const { session: s, calls } = session({
      "PUT /me/player": () => null,
      "PUT /me/player/play": () => {
        if (active) return null;
        throw new SpotifyError(404, "Spotify: Not found.");
      },
      "GET /me/player/devices": () => ({ devices: [{ id: "phone" }, { id: "mac" }] }),
      "PUT /me/player/play?device_id=mac": () => null,
      "GET /me/player": () => playing,
    });
    const player = new SpotifyPlayer(s);
    player.playback = parsePlayback(playing, 0);
    await player.selectDevice("mac");
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ device_ids: ["mac"], play: true });
    active = false;
    await player.play("spotify:album:a1");
    expect(calls.map((c) => c.path)).toContain("/me/player/play?device_id=mac");
  });
});
