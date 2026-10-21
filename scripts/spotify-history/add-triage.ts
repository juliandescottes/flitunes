// Adds the albums of history-albums.csv to library.json, tagged "triage",
// to review in the app's Triage source (see README.md).
//
//   node scripts/spotify-history/add-triage.ts <library.json> <history-albums.csv>
//       [--drop-artist NAME]... [--write]
//
// Without --write it only reports. With --write it backs the library up next
// to the CSV, bumps exportedAt, validates, and writes the file. Save in the
// app first: it must have no unsaved changes.
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { ulid } from "ulid";
import { parseCsv } from "../../src/lib/csv.ts";
import { parseLibraryFile, serializeLibraryFile } from "../../src/lib/serialize.ts";
import { triageAlbums } from "./lib.ts";

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "drop-artist": { type: "string", multiple: true, default: [] },
    write: { type: "boolean", default: false },
  },
});
const [libraryPath, csvPath] = positionals;
if (!csvPath) {
  console.error("Usage: node scripts/spotify-history/add-triage.ts <library.json> <history-albums.csv> [--drop-artist NAME]... [--write]");
  process.exit(1);
}

const library = parseLibraryFile(readFileSync(libraryPath, "utf8"));
const [header, ...records] = parseCsv(readFileSync(csvPath, "utf8"));
const rows = records.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
const { added, skipped } = triageAlbums(rows, library.albums, { dropArtists: options["drop-artist"], newId: ulid });

const line = (r: Record<string, string>) => `  ${r.artist} – ${r.album} (${r.plays} plays)`;
console.log(`${rows.length} rows: ${skipped.inLibrary} already in the library, ${skipped.dropped.length} dropped, ${skipped.duplicates.length} duplicate editions`);
console.log(`${added.length} to add, tagged triage (library: ${library.albums.length} → ${library.albums.length + added.length})`);
if (skipped.dropped.length) console.log("\nDropped:\n" + skipped.dropped.map(line).join("\n"));
if (skipped.duplicates.length) console.log("\nOther editions (linked from the kept one's notes):\n" + skipped.duplicates.map(line).join("\n"));

if (options.write) {
  const backup = join(dirname(csvPath), `library.backup-${Date.now()}.json`);
  copyFileSync(libraryPath, backup);
  const text = serializeLibraryFile({ ...library, exportedAt: new Date().toISOString(), albums: [...library.albums, ...added] });
  parseLibraryFile(text);
  writeFileSync(libraryPath, text);
  console.log(`\nWritten. Backup: ${backup}`);
} else {
  console.log("\nDry run: add --write to change the library.");
}
