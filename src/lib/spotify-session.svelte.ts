// Reactive Spotify sign-in state for the UI. Signing in is optional: without
// a client ID (VITE_SPOTIFY_CLIENT_ID) or while signed out, albums stay
// plain links that open the Spotify app.

import {
  accessToken,
  authorizeUrl,
  completeLogin,
  isLoginRedirect,
  signOut,
  storedTokens,
  type AuthConfig,
  type KeyValueStore,
} from "./spotify-auth.ts";

const API = "https://api.spotify.com/v1";

/** A Web API error, with its HTTP status. */
export class SpotifyError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type SpotifyStatus = "disabled" | "signed-out" | "signing-in" | "signed-in";

export class SpotifySession {
  status = $state<SpotifyStatus>("disabled");
  /** Display name of the signed-in account. */
  user = $state<string | null>(null);
  error = $state<string | null>(null);

  #config: AuthConfig | null;

  /** `config` is null when no client ID is configured: the feature is off. */
  constructor(config: AuthConfig | null) {
    this.#config = config;
    if (config) this.status = storedTokens(config) ? "signed-in" : "signed-out";
  }

  /**
   * Finishes a sign-in when the page is Spotify's redirect back, then loads
   * the account name. Returns the page parameters to remove from the address.
   */
  async init(params: URLSearchParams): Promise<string[]> {
    const config = this.#config;
    if (!config) return [];
    let handled: string[] = [];
    if (isLoginRedirect(params)) {
      handled = ["code", "state", "error"];
      this.status = "signing-in";
      try {
        await completeLogin(config, params);
      } catch (e) {
        this.error = (e as Error).message;
      }
      this.status = storedTokens(config) ? "signed-in" : "signed-out";
    }
    if (this.status === "signed-in") {
      try {
        const me = (await this.api("/me")) as { display_name?: string; id: string } | null;
        this.user = me ? (me.display_name ?? me.id) : null;
      } catch (e) {
        this.error = (e as Error).message;
      }
    }
    return handled;
  }

  async signIn(): Promise<void> {
    if (!this.#config) return;
    this.error = null;
    location.assign(await authorizeUrl(this.#config));
  }

  signOut(): void {
    if (!this.#config) return;
    signOut(this.#config);
    this.status = "signed-out";
    this.user = null;
  }

  /**
   * Calls the Web API as the signed-in user. Returns the JSON body, or null
   * for an empty response (204). Signs out if Spotify no longer accepts the token.
   */
  async api(path: string, init: RequestInit = {}): Promise<unknown> {
    const config = this.#config;
    if (!config) throw new Error("Spotify isn't configured");
    let token: string | null;
    try {
      token = await accessToken(config);
    } catch (e) {
      this.#signedOut();
      throw e;
    }
    if (!token) {
      this.#signedOut();
      throw new Error("Not signed in to Spotify");
    }
    const res = await config.fetch(`${API}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      signOut(config);
      this.#signedOut();
      throw new Error("Spotify signed you out. Please connect again.");
    }
    if (res.status === 204 || res.headers.get("content-length") === "0") return null;
    const data = parseBody(await res.text());
    if (!res.ok) throw new SpotifyError(res.status, `Spotify: ${data?.error?.message ?? `HTTP ${res.status}`}`);
    return data;
  }

  #signedOut() {
    this.status = "signed-out";
    this.user = null;
  }
}

/**
 * Reads a response body as JSON. Some player commands answer 200 with a body
 * that isn't JSON: that counts as an empty response.
 */
function parseBody(text: string): { error?: { message?: string } } | null {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/** Storage that never throws (private windows, blocked site data). */
function safeStorage(get: () => Storage): KeyValueStore {
  const attempt = <T>(f: (s: Storage) => T, fallback: T): T => {
    try {
      return f(get());
    } catch {
      return fallback;
    }
  };
  return {
    getItem: (k) => attempt((s) => s.getItem(k), null),
    setItem: (k, v) => attempt((s) => s.setItem(k, v), undefined),
    removeItem: (k) => attempt((s) => s.removeItem(k), undefined),
  };
}

/** The session for this page: configured from the build's client ID and the page address. */
export function browserSession(): SpotifySession {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
  if (!clientId) return new SpotifySession(null);
  return new SpotifySession({
    clientId,
    // The app's own address: http://127.0.0.1:5173/ in dev, the Pages URL in production.
    redirectUri: `${location.origin}${location.pathname}`,
    tokens: safeStorage(() => localStorage),
    pending: safeStorage(() => sessionStorage),
    fetch: (...args) => fetch(...args),
  });
}
