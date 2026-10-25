// Debug log for the Spotify integration, in the browser console: every Web
// API call (start, status, duration), token refreshes, and the player's
// retries. Filter the console on "[Spotify]". It never logs tokens.
// Details are logged as JSON text, so a copied log is complete (the console
// would show objects folded).

const quiet = import.meta.env.MODE === "test";

export function spotifyLog(message: string, details?: unknown): void {
  if (quiet) return;
  const time = new Date().toISOString().slice(11, 23);
  if (details === undefined) console.debug(`[Spotify] ${time} ${message}`);
  else console.debug(`[Spotify] ${time} ${message} ${typeof details === "string" ? details : JSON.stringify(details)}`);
}
