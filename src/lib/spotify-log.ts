// Debug log for the Spotify integration, in the browser console: every Web
// API call (start, status, duration), token refreshes, and the player's
// retries. Filter the console on "[Spotify]". It never logs tokens.

const quiet = import.meta.env.MODE === "test";

export function spotifyLog(message: string, details?: unknown): void {
  if (quiet) return;
  const time = new Date().toISOString().slice(11, 23);
  if (details === undefined) console.debug(`[Spotify] ${time} ${message}`);
  else console.debug(`[Spotify] ${time} ${message}`, details);
}
