// Spotify sign-in, entirely in the browser: OAuth authorization code flow
// with PKCE, so there is no client secret and no backend. The access token
// is only used for playback (see docs/spec.md); nothing from Spotify is
// saved to the library.

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

/** Playback control and status. */
export const SCOPES = ["user-read-playback-state", "user-modify-playback-state", "user-read-currently-playing"];

/** Refresh the access token when it expires within this many milliseconds. */
const EXPIRY_MARGIN = 60_000;

const TOKENS_KEY = "album-library:spotify-tokens";
const PENDING_KEY = "album-library:spotify-login";

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  /** Milliseconds since the epoch. */
  expiresAt: number;
}

/** The parts of Storage used here, so tests can pass a Map-backed one. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AuthConfig {
  clientId: string;
  /** Must be registered in the Spotify app's settings, exactly. */
  redirectUri: string;
  /** Keeps the tokens across visits (localStorage). */
  tokens: KeyValueStore;
  /** Keeps the PKCE verifier during the redirect to Spotify (sessionStorage). */
  pending: KeyValueStore;
  fetch: typeof fetch;
  now?: () => number;
}

export class SpotifyAuthError extends Error {}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A random URL-safe string from `bytes` random bytes. */
export function randomString(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** The PKCE S256 challenge for a verifier: base64url(SHA-256(verifier)). */
export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** The Spotify sign-in page to send the user to. Remembers what's needed to finish signing in. */
export async function authorizeUrl(config: AuthConfig): Promise<string> {
  const verifier = randomString(64);
  const state = randomString(16);
  config.pending.setItem(PENDING_KEY, JSON.stringify({ verifier, state }));
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    code_challenge_method: "S256",
    code_challenge: await codeChallenge(verifier),
    scope: SCOPES.join(" "),
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

/** Whether these page parameters are Spotify sending the user back after signing in. */
export function isLoginRedirect(params: URLSearchParams): boolean {
  return params.has("state") && (params.has("code") || params.has("error"));
}

/** Finishes signing in from the parameters Spotify redirected back with. */
export async function completeLogin(config: AuthConfig, params: URLSearchParams): Promise<SpotifyTokens> {
  const pending = config.pending.getItem(PENDING_KEY);
  config.pending.removeItem(PENDING_KEY);
  const { verifier, state } = pending ? (JSON.parse(pending) as { verifier: string; state: string }) : ({} as never);
  if (!verifier || params.get("state") !== state) {
    throw new SpotifyAuthError("This Spotify sign-in wasn't started here. Please try again.");
  }
  const error = params.get("error");
  if (error) {
    throw new SpotifyAuthError(error === "access_denied" ? "Spotify sign-in was cancelled." : `Spotify sign-in failed: ${error}`);
  }
  return requestTokens(config, {
    grant_type: "authorization_code",
    code: params.get("code") ?? "",
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  });
}

/** A valid access token, refreshed if needed, or null when not signed in. */
export async function accessToken(config: AuthConfig): Promise<string | null> {
  const tokens = storedTokens(config);
  if (!tokens) return null;
  const now = (config.now ?? Date.now)();
  if (tokens.expiresAt - EXPIRY_MARGIN > now) return tokens.accessToken;
  try {
    const refreshed = await requestTokens(config, { grant_type: "refresh_token", refresh_token: tokens.refreshToken });
    return refreshed.accessToken;
  } catch (e) {
    // A revoked or expired refresh token means signing in again.
    if (e instanceof SpotifyAuthError) signOut(config);
    throw e;
  }
}

export function storedTokens(config: AuthConfig): SpotifyTokens | null {
  const text = config.tokens.getItem(TOKENS_KEY);
  if (!text) return null;
  try {
    const t = JSON.parse(text) as SpotifyTokens;
    return typeof t.accessToken === "string" && typeof t.refreshToken === "string" && typeof t.expiresAt === "number"
      ? t
      : null;
  } catch {
    return null;
  }
}

export function signOut(config: AuthConfig): void {
  config.tokens.removeItem(TOKENS_KEY);
}

async function requestTokens(config: AuthConfig, body: Record<string, string>): Promise<SpotifyTokens> {
  const res = await config.fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, ...body }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new SpotifyAuthError(`Spotify sign-in failed: ${data.error_description ?? data.error ?? `HTTP ${res.status}`}`);
  }
  const tokens: SpotifyTokens = {
    accessToken: data.access_token,
    // A refresh may not return a new refresh token: keep the current one.
    refreshToken: data.refresh_token ?? storedTokens(config)?.refreshToken ?? "",
    expiresAt: (config.now ?? Date.now)() + (data.expires_in ?? 3600) * 1000,
  };
  config.tokens.setItem(TOKENS_KEY, JSON.stringify(tokens));
  return tokens;
}
