import { describe, expect, it } from "vitest";
import { authorizeUrl, type AuthConfig, type KeyValueStore } from "./spotify-auth.ts";
import { SpotifySession } from "./spotify-session.svelte.ts";

function store(): KeyValueStore {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

/** A config whose fetch answers the token endpoint and the given API routes. */
function config(api: Record<string, () => Response>): AuthConfig {
  return {
    clientId: "client-1",
    redirectUri: "http://127.0.0.1:5173/",
    tokens: store(),
    pending: store(),
    fetch: (async (url: string) => {
      if (url === "https://accounts.spotify.com/api/token") {
        return Response.json({ access_token: "a1", refresh_token: "r1", expires_in: 3600 });
      }
      const route = api[url.replace("https://api.spotify.com/v1", "")];
      return route ? route() : new Response("{}", { status: 404 });
    }) as typeof fetch,
  };
}

async function signedIn(api: Record<string, () => Response>) {
  const cfg = config({ "/me": () => Response.json({ id: "fli", display_name: "Fli" }), ...api });
  const state = new URL(await authorizeUrl(cfg)).searchParams.get("state")!;
  const session = new SpotifySession(cfg);
  const handled = await session.init(new URLSearchParams({ code: "c", state }));
  return { session, handled };
}

describe("SpotifySession", () => {
  it("is disabled without a configuration", async () => {
    const session = new SpotifySession(null);
    expect(session.status).toBe("disabled");
    expect(await session.init(new URLSearchParams("code=c&state=s"))).toEqual([]);
  });

  it("starts signed out", () => {
    expect(new SpotifySession(config({})).status).toBe("signed-out");
  });

  it("finishes signing in from the redirect and loads the account name", async () => {
    const { session, handled } = await signedIn({});
    expect(session.status).toBe("signed-in");
    expect(session.user).toBe("Fli");
    expect(handled).toEqual(["code", "state", "error"]);
  });

  it("reports a failed sign-in and stays signed out", async () => {
    const session = new SpotifySession(config({}));
    await session.init(new URLSearchParams({ code: "c", state: "unknown" }));
    expect(session.status).toBe("signed-out");
    expect(session.error).toContain("try again");
  });

  it("returns null for empty API responses", async () => {
    const { session } = await signedIn({ "/me/player/pause": () => new Response(null, { status: 204 }) });
    expect(await session.api("/me/player/pause", { method: "PUT" })).toBeNull();
  });

  it("signs out when Spotify rejects the token", async () => {
    const { session } = await signedIn({ "/me/player": () => new Response("{}", { status: 401 }) });
    await expect(session.api("/me/player")).rejects.toThrow("connect again");
    expect(session.status).toBe("signed-out");
    expect(session.user).toBeNull();
  });

  it("reports API errors with Spotify's message", async () => {
    const { session } = await signedIn({
      "/me/player/play": () => Response.json({ error: { status: 404, message: "No active device found" } }, { status: 404 }),
    });
    await expect(session.api("/me/player/play", { method: "PUT" })).rejects.toThrow("No active device found");
    expect(session.status).toBe("signed-in");
  });
});
