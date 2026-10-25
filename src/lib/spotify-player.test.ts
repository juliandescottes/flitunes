import { describe, expect, it } from "vitest";
import type { KeyValueStore } from "./spotify-auth.ts";
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

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

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

  it("tries the next device when the first one can't be woken, and remembers the one that played", async () => {
    const store = memoryStore();
    const { session: s, calls } = session({
      "PUT /me/player/play": () => {
        throw new SpotifyError(404, "Spotify: Player command failed: No active device found");
      },
      "GET /me/player/devices": () => ({ devices: [{ id: "asleep", name: "Other Mac" }, { id: "mac", name: "This Mac" }] }),
      "PUT /me/player/play?device_id=asleep": () => {
        throw new SpotifyError(404, "Spotify: Not found.");
      },
      "PUT /me/player/play?device_id=mac": () => null,
      "GET /me/player": () => playing,
    });
    const player = new SpotifyPlayer(s, Date.now, store);
    await player.play("spotify:album:a1");
    expect(player.error).toBeNull();
    expect(store.getItem("album-library:spotify-device")).toBe("mac");

    // After a reload, the remembered device is tried first.
    calls.length = 0;
    await new SpotifyPlayer(s, Date.now, store).play("spotify:album:a1");
    expect(calls.map((c) => c.path).filter((p) => p.includes("device_id"))).toEqual(["/me/player/play?device_id=mac"]);
  });

  it("names the devices when none of them can be reached", async () => {
    const { session: s } = session({
      "PUT /me/player/play": () => {
        throw new SpotifyError(404, "Spotify: No active device found");
      },
      "GET /me/player/devices": () => ({ devices: [{ id: "asleep", name: "Other Mac" }] }),
      "PUT /me/player/play?device_id=asleep": () => {
        throw new SpotifyError(404, "Spotify: Not found.");
      },
      "GET /me/player": () => null,
    });
    const player = new SpotifyPlayer(s);
    await player.play("spotify:album:a1");
    expect(player.error).toContain("couldn't reach Other Mac");
  });

  it("tries the active device first, and skips a remembered one Spotify no longer lists", async () => {
    const store = memoryStore();
    store.setItem("album-library:spotify-device", "gone");
    const { session: s, calls } = session({
      "PUT /me/player/play": () => {
        throw new SpotifyError(404, "Spotify: Not found.");
      },
      "GET /me/player/devices": () => ({ devices: [{ id: "phone" }, { id: "mac", is_active: true }] }),
      "PUT /me/player/play?device_id=mac": () => null,
      "GET /me/player": () => playing,
    });
    await new SpotifyPlayer(s, Date.now, store).play("spotify:album:a1");
    expect(calls.map((c) => c.path).filter((p) => p.includes("device_id"))).toEqual(["/me/player/play?device_id=mac"]);
    expect(store.getItem("album-library:spotify-device")).toBe("mac");
  });

  it("goes on to the next device after a server or network error, but not after other errors", async () => {
    const devices = { devices: [{ id: "a" }, { id: "b" }, { id: "c" }] };
    const noActive = () => {
      throw new SpotifyError(404, "Spotify: No active device found");
    };
    const { session: s, calls } = session({
      "PUT /me/player/play": noActive,
      "GET /me/player/devices": () => devices,
      "PUT /me/player/play?device_id=a": () => {
        throw new SpotifyError(502, "Spotify: Bad gateway");
      },
      "PUT /me/player/play?device_id=b": () => {
        throw new TypeError("NetworkError when attempting to fetch resource.");
      },
      "PUT /me/player/play?device_id=c": () => null,
      "GET /me/player": () => playing,
    });
    const player = new SpotifyPlayer(s);
    await player.play("spotify:album:a1");
    expect(calls.map((c) => c.path)).toContain("/me/player/play?device_id=c");
    expect(player.error).toBeNull();

    const { session: s2, calls: calls2 } = session({
      "PUT /me/player/play": noActive,
      "GET /me/player/devices": () => devices,
      "PUT /me/player/play?device_id=a": () => {
        throw new SpotifyError(429, "Spotify: API rate limit exceeded");
      },
      "GET /me/player": () => null,
    });
    const limited = new SpotifyPlayer(s2);
    await limited.play("spotify:album:a1");
    expect(calls2.map((c) => c.path)).not.toContain("/me/player/play?device_id=b");
    expect(limited.error).toContain("rate limit");
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

  it("takes a 404 on pause as nothing to pause, without waking a device", async () => {
    const { session: s, calls } = session({
      "PUT /me/player/pause": () => {
        throw new SpotifyError(404, "Spotify: Player command failed: No active device found");
      },
      "GET /me/player": () => null,
    });
    const player = new SpotifyPlayer(s);
    player.playback = parsePlayback(playing, 0);
    await player.togglePlay();
    expect(calls.map((c) => c.path)).not.toContain("/me/player/devices");
    expect(player.error).toBeNull();
  });

  it("doesn't remember a device that only took a next", async () => {
    const store = memoryStore();
    const { session: s } = session({
      "POST /me/player/next": () => {
        throw new SpotifyError(404, "Spotify: Not found.");
      },
      "GET /me/player/devices": () => ({ devices: [{ id: "mac" }] }),
      "POST /me/player/next?device_id=mac": () => null,
      "GET /me/player": () => playing,
    });
    await new SpotifyPlayer(s, Date.now, store).next();
    expect(store.getItem("album-library:spotify-device")).toBeNull();
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
    const store = memoryStore();
    const player = new SpotifyPlayer(s, Date.now, store);
    player.playback = parsePlayback(playing, 0);
    await player.selectDevice("mac");
    expect(store.getItem("album-library:spotify-device")).toBe("mac");
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ device_ids: ["mac"], play: true });
    active = false;
    await player.play("spotify:album:a1");
    expect(calls.map((c) => c.path)).toContain("/me/player/play?device_id=mac");
  });

  it("doesn't remember a device it couldn't move playback to", async () => {
    const store = memoryStore();
    const { session: s } = session({
      "PUT /me/player": () => {
        throw new SpotifyError(404, "Spotify: Device not found");
      },
      "GET /me/player": () => null,
    });
    const player = new SpotifyPlayer(s, Date.now, store);
    await player.selectDevice("asleep");
    expect(store.getItem("album-library:spotify-device")).toBeNull();
    expect(player.error).toContain("Device not found");
  });
});
