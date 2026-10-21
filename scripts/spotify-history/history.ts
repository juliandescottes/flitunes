// Albums you listened to, from a Spotify "Extended streaming history"
// export, as a CSV for the app (see README.md).
//
//   node scripts/spotify-history/history.ts <export-dir> <library.json> <work-dir>
//       [--min-plays 10] [--min-tracks 3] [--offline] [--limit N]
//
// 1. Adds up listens (plays of 30 s or more) per (album artist, album name)
//    and keeps pairs with enough listens over enough distinct tracks.
// 2. Finds each pair's Spotify album from the public web pages (track page,
//    then album page): one request at a time, paced, resumable. Results go to
//    <work-dir>/history-albums.jsonl as they come; re-run to resume.
//    --offline stops after step 1, --limit resolves at most N pairs per run.
// 3. Writes <work-dir>/history-albums.csv: one row per album not already in
//    the library, most played first.
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseCsvAlbums } from "../../src/lib/csv.ts";
import { parseLibraryFile } from "../../src/lib/serialize.ts";
import {
  aggregate,
  albumListens,
  albumRows,
  isSpotifyPage,
  pairKey,
  parseAlbumPage,
  parseMetas,
  toCsv,
  trackAlbumId,
  type Play,
  type Resolved,
  type SpotifyAlbum,
} from "./lib.ts";

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "min-plays": { type: "string", default: "10" },
    "min-tracks": { type: "string", default: "3" },
    offline: { type: "boolean", default: false },
    limit: { type: "string" },
  },
});
const [exportDir, libraryPath, workDir] = positionals;
if (!workDir) {
  console.error("Usage: node scripts/spotify-history/history.ts <export-dir> <library.json> <work-dir> [options]");
  process.exit(1);
}
const minPlays = Number(options["min-plays"]);
const minTracks = Number(options["min-tracks"]);
const cachePath = join(workDir, "history-albums.jsonl");
const csvPath = join(workDir, "history-albums.csv");

// Be gentle with Spotify: one request at a time, well apart, saying who we are.
const PAUSE_MS = 1600;
const MAX_WAIT_S = 120; // a longer Retry-After stops the run
const USER_AGENT = "FliTunes-import/1.0 (+https://github.com/juliandescottes/flitunes)";

// --- 1. Aggregate ---

function* plays(): Generator<Play> {
  const files = readdirSync(exportDir).filter((f) => /^Streaming_History_Audio_.*\.json$/.test(f)).sort();
  if (files.length === 0) throw new Error(`No Streaming_History_Audio_*.json in ${exportDir}`);
  for (const file of files) {
    for (const raw of JSON.parse(readFileSync(join(exportDir, file), "utf8")) as Record<string, unknown>[]) {
      // Only these fields; the others (IP address, device, country…) are left alone.
      yield {
        ts: raw.ts as string | null,
        ms_played: raw.ms_played as number | null,
        master_metadata_album_artist_name: raw.master_metadata_album_artist_name as string | null,
        master_metadata_album_album_name: raw.master_metadata_album_album_name as string | null,
        spotify_track_uri: raw.spotify_track_uri as string | null,
      };
    }
  }
}

const pairs = aggregate(plays());
const { kept, fewPlays, fewTracks } = albumListens(pairs, minPlays, minTracks);
console.log(`${pairs.length} (artist, album) pairs with listens of 30 s or more`);
console.log(`  ${fewPlays} with fewer than ${minPlays} listens, ${fewTracks} with fewer than ${minTracks} tracks`);
console.log(`  ${kept.length} kept`);
if (options.offline) process.exit(0);

// --- 2. Resolve ---

class Stop extends Error {}
class NotFound extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequest = 0;

/** A page's text. 404 → NotFound; Stop when Spotify refuses (after one retry a minute later). */
async function fetchPage(url: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    await sleep(Math.max(0, lastRequest + PAUSE_MS - Date.now()));
    lastRequest = Date.now();
    let response: Response;
    try {
      response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(30_000) });
    } catch (e) {
      // Network error or timeout (e.g. the computer just woke up).
      if (attempt > 0) throw new Stop(`network error: ${(e as Error).message}`);
      await sleep(60_000);
      continue;
    }
    if (response.ok) return response.text();
    if (response.status === 404) throw new NotFound();
    if (response.status === 429) {
      const wait = Number(response.headers.get("Retry-After") ?? "60");
      if (wait > MAX_WAIT_S) throw new Stop(`429, Retry-After ${wait} s`);
      console.log(`429: waiting ${wait} s`);
      await sleep((wait + 1) * 1000);
      continue;
    }
    if (attempt > 0 || (response.status !== 403 && response.status < 500)) throw new Stop(`HTTP ${response.status}`);
    console.log(`HTTP ${response.status}: retrying in a minute`);
    await sleep(60_000);
  }
}

/** A page's <meta> tags; a page without them (a captcha?) is retried once, then stops the run. */
async function pageMetas(url: string): Promise<Map<string, string>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const metas = parseMetas(await fetchPage(url));
    if (isSpotifyPage(metas)) return metas;
    if (attempt === 0) {
      console.log("Page without the expected tags: retrying in a minute");
      await sleep(60_000);
    }
  }
  throw new Stop(`page without the expected tags: ${url}`);
}

async function resolve(pair: (typeof kept)[number], albums: Map<string, SpotifyAlbum>): Promise<Resolved> {
  const base = { artist: pair.artist, album: pair.album, sample_track: pair.sample_track };
  let albumId: string | null;
  try {
    albumId = trackAlbumId(await pageMetas(`https://open.spotify.com/track/${pair.sample_track}`));
  } catch (e) {
    if (!(e instanceof NotFound)) throw e;
    albumId = null;
  }
  if (!albumId) return { ...base, status: "failed", reason: "track removed or without album" };
  let album = albums.get(albumId);
  if (!album) {
    try {
      album = parseAlbumPage(await pageMetas(`https://open.spotify.com/album/${albumId}`));
    } catch (e) {
      if (e instanceof Stop) throw e;
      return { ...base, status: "failed", reason: e instanceof NotFound ? "album page not found" : (e as Error).message, album_id: albumId };
    }
    albums.set(albumId, album);
  }
  return { ...base, status: "ok", album_id: albumId, spotify_album: album };
}

const resolved = new Map<string, Resolved>();
const albums = new Map<string, SpotifyAlbum>();
if (existsSync(cachePath)) {
  for (const line of readFileSync(cachePath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as Resolved;
    resolved.set(pairKey(r), r);
    if (r.album_id && r.spotify_album) albums.set(r.album_id, r.spotify_album);
  }
}
const todo = kept.filter((p) => !resolved.has(pairKey(p))).slice(0, options.limit ? Number(options.limit) : undefined);
console.log(`${kept.length - todo.length} pairs already resolved, ${todo.length} to go`);
let stopped: string | null = null;
for (const [i, pair] of todo.entries()) {
  try {
    const r = await resolve(pair, albums);
    resolved.set(pairKey(r), r);
    appendFileSync(cachePath, JSON.stringify(r) + "\n");
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    stopped = e.message;
    break;
  }
  if ((i + 1) % 50 === 0) console.log(`${i + 1} / ${todo.length}`);
}
const results = kept.flatMap((p) => resolved.get(pairKey(p)) ?? []);
const failed = results.filter((r) => r.status === "failed").length;
console.log(`resolved ${results.length - failed}, failed ${failed}, not done yet ${kept.length - results.length}`);
if (stopped) console.log(`Stopped: Spotify refused pages (${stopped}). Progress is saved: re-run later to resume.`);

// --- 3. Write the CSV ---

const library = parseLibraryFile(readFileSync(libraryPath, "utf8"));
const { rows, albums: albumCount, mergedAlbums, byLink, byKey } = albumRows(kept, resolved, library.albums);
console.log(`${results.length - failed} pairs → ${albumCount} albums (${mergedAlbums} from several pairs)`);
console.log(`already in the library: ${byLink} by Spotify link, ${byKey} by artist and title`);
const csv = toCsv(rows);
// The app must read it back as written.
if (parseCsvAlbums(csv).length !== rows.length) throw new Error("The app's CSV parser doesn't read the CSV back");
writeFileSync(csvPath, csv);
console.log(`${rows.length} albums written to ${csvPath}`);
process.exitCode = stopped ? 2 : 0;
