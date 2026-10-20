import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  accessToken,
  authorizeUrl,
  codeChallenge,
  completeLogin,
  isLoginRedirect,
  SpotifyAuthError,
  storedTokens,
  type AuthConfig,
  type KeyValueStore,
} from "./spotify-auth.ts";

function store(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

interface Call {
  url: string;
  body: URLSearchParams;
}

function config(responses: { status?: number; json: object }[] = []) {
  const calls: Call[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body as URLSearchParams });
    const r = responses.shift() ?? { json: {} };
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  }) as typeof globalThis.fetch;
  let now = 1_000_000;
  const cfg: AuthConfig & { tick(ms: number): void } = {
    clientId: "client-1",
    redirectUri: "http://127.0.0.1:5173/",
    tokens: store(),
    pending: store(),
    fetch,
    now: () => now,
    tick: (ms) => (now += ms),
  };
  return { cfg, calls };
}

async function signIn(cfg: AuthConfig) {
  const url = new URL(await authorizeUrl(cfg));
  const params = new URLSearchParams({ code: "code-1", state: url.searchParams.get("state")! });
  return completeLogin(cfg, params);
}

describe("codeChallenge", () => {
  it("is the base64url SHA-256 of the verifier", async () => {
    const verifier = "dBjftJeZ4CVP-mJ92K1aGs_-0rqgM8jSnRJhCm-4kHM";
    expect(await codeChallenge(verifier)).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });
});

describe("authorizeUrl", () => {
  it("asks for a code with a PKCE challenge and the playback scopes", async () => {
    const { cfg } = config();
    const url = new URL(await authorizeUrl(cfg));
    expect(url.origin + url.pathname).toBe("https://accounts.spotify.com/authorize");
    const p = url.searchParams;
    expect(p.get("client_id")).toBe("client-1");
    expect(p.get("response_type")).toBe("code");
    expect(p.get("redirect_uri")).toBe("http://127.0.0.1:5173/");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("scope")).toContain("user-modify-playback-state");
    const { verifier, state } = JSON.parse([...(cfg.pending as ReturnType<typeof store>).map.values()][0]);
    expect(p.get("state")).toBe(state);
    expect(p.get("code_challenge")).toBe(await codeChallenge(verifier));
  });
});

describe("completeLogin", () => {
  it("exchanges the code with the verifier and stores the tokens", async () => {
    const { cfg, calls } = config([{ json: { access_token: "a1", refresh_token: "r1", expires_in: 3600 } }]);
    const tokens = await signIn(cfg);
    expect(tokens).toEqual({ accessToken: "a1", refreshToken: "r1", expiresAt: 1_000_000 + 3_600_000 });
    expect(storedTokens(cfg)).toEqual(tokens);
    expect(calls[0].url).toBe("https://accounts.spotify.com/api/token");
    expect(calls[0].body.get("grant_type")).toBe("authorization_code");
    expect(calls[0].body.get("code")).toBe("code-1");
    expect(calls[0].body.get("client_id")).toBe("client-1");
    expect(calls[0].body.get("code_verifier")).toBeTruthy();
  });

  it("rejects a redirect with another state", async () => {
    const { cfg, calls } = config();
    await authorizeUrl(cfg);
    await expect(completeLogin(cfg, new URLSearchParams({ code: "c", state: "forged" }))).rejects.toThrow(
      SpotifyAuthError,
    );
    expect(calls).toHaveLength(0);
  });

  it("reports a cancelled sign-in", async () => {
    const { cfg } = config();
    const state = new URL(await authorizeUrl(cfg)).searchParams.get("state")!;
    await expect(completeLogin(cfg, new URLSearchParams({ error: "access_denied", state }))).rejects.toThrow(
      "cancelled",
    );
  });

  it("reports a failed token exchange", async () => {
    const { cfg } = config([{ status: 400, json: { error: "invalid_grant", error_description: "Invalid code" } }]);
    await expect(signIn(cfg)).rejects.toThrow("Invalid code");
    expect(storedTokens(cfg)).toBeNull();
  });
});

describe("accessToken", () => {
  it("is null when signed out", async () => {
    expect(await accessToken(config().cfg)).toBeNull();
  });

  it("reuses a valid token and refreshes one about to expire", async () => {
    const { cfg, calls } = config([
      { json: { access_token: "a1", refresh_token: "r1", expires_in: 3600 } },
      { json: { access_token: "a2", expires_in: 3600 } },
    ]);
    await signIn(cfg);
    expect(await accessToken(cfg)).toBe("a1");
    cfg.tick(3_600_000 - 30_000);
    expect(await accessToken(cfg)).toBe("a2");
    expect(calls[1].body.get("grant_type")).toBe("refresh_token");
    expect(calls[1].body.get("refresh_token")).toBe("r1");
    // The refresh token is kept when Spotify doesn't send a new one.
    expect(storedTokens(cfg)?.refreshToken).toBe("r1");
  });

  it("signs out when the refresh token is rejected", async () => {
    const { cfg } = config([
      { json: { access_token: "a1", refresh_token: "r1", expires_in: 3600 } },
      { status: 400, json: { error: "invalid_grant" } },
    ]);
    await signIn(cfg);
    cfg.tick(3_600_000);
    await expect(accessToken(cfg)).rejects.toThrow(SpotifyAuthError);
    expect(storedTokens(cfg)).toBeNull();
  });
});

describe("isLoginRedirect", () => {
  it("recognizes Spotify's redirect parameters only", () => {
    expect(isLoginRedirect(new URLSearchParams("code=c&state=s"))).toBe(true);
    expect(isLoginRedirect(new URLSearchParams("error=access_denied&state=s"))).toBe(true);
    expect(isLoginRedirect(new URLSearchParams("library=x"))).toBe(false);
  });
});
