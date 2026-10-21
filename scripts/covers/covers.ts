// Copies the library's covers into its covers/ folder (next to library.json),
// so they no longer depend on Spotify's image servers (see README.md).
//
//   node scripts/covers/covers.ts <library.json> [--limit N] [--write]
//
// Downloads each cover that is still a URL to covers/<album id>.<ext>, one
// at a time. It's resumable: files already there are kept. Without --write,
// library.json is untouched. With --write it then backs the library up,
// points the albums at their files, bumps exportedAt, validates, and writes
// it. Save in the app first: it must have no unsaved changes.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { parseLibraryFile, serializeLibraryFile } from "../../src/lib/serialize.ts";
import { coversToDownload, imageExtension, useDownloadedCovers } from "./lib.ts";

const USER_AGENT = "FliTunes-covers/1.0 (+https://github.com/juliandescottes/flitunes)";
/** Pause between downloads, to stay gentle with image servers. */
const PAUSE_MS = 150;

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    limit: { type: "string" },
    write: { type: "boolean", default: false },
  },
});
const [libraryPath] = positionals;
if (!libraryPath) {
  console.error("Usage: node scripts/covers/covers.ts <library.json> [--limit N] [--write]");
  process.exit(1);
}

const library = parseLibraryFile(readFileSync(libraryPath, "utf8"));
const folder = join(dirname(libraryPath), "covers");
mkdirSync(folder, { recursive: true });
const files = () => new Set(readdirSync(folder));

const todo = coversToDownload(library.albums, files());
const batch = options.limit ? todo.slice(0, Number(options.limit)) : todo;
console.log(`${library.albums.length} albums, ${todo.length} covers to download${batch.length < todo.length ? ` (this run: ${batch.length})` : ""}`);

const failed: string[] = [];
for (const [i, album] of batch.entries()) {
  try {
    const res = await fetch(album.cover!, { headers: { "User-Agent": USER_AGENT } });
    if (res.status === 429 || res.status === 403) {
      console.error(`\nStopped: HTTP ${res.status} from ${new URL(album.cover!).host}. Run again later to resume.`);
      break;
    }
    const ext = imageExtension(res.headers.get("content-type"));
    if (!res.ok || !ext) throw new Error(res.ok ? `not an image (${res.headers.get("content-type")})` : `HTTP ${res.status}`);
    const tmp = join(folder, `.${album.id}.tmp`);
    writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
    renameSync(tmp, join(folder, `${album.id}.${ext}`));
  } catch (e) {
    failed.push(`  ${album.artists.join(", ")} – ${album.title}: ${(e as Error).message} (${album.cover})`);
  }
  if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${batch.length}`);
  await new Promise((r) => setTimeout(r, PAUSE_MS));
}
if (failed.length) console.log(`\n${failed.length} failed (their cover stays a URL):\n${failed.join("\n")}`);

const { albums, changed } = useDownloadedCovers(library.albums, files());
if (options.write) {
  if (changed === 0) {
    console.log("\nNo album to update.");
  } else {
    const backup = join(tmpdir(), `library.backup-${Date.now()}.json`);
    copyFileSync(libraryPath, backup);
    const text = serializeLibraryFile({ ...library, exportedAt: new Date().toISOString(), albums });
    parseLibraryFile(text);
    writeFileSync(libraryPath, text);
    console.log(`\n${changed} albums now use their file in covers/. Backup: ${backup}`);
  }
} else {
  console.log(`\nDry run for library.json: ${changed} albums would use their file in covers/. Add --write to update it.`);
}
