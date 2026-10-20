// Writes a mock library.json for performance testing in the browser.
//
//   node scripts/mock-library.ts <out.json> [albums] [covers-from.json]
//
// Covers are reused from another library file when given (only read).
// Refuses to overwrite an existing file. Then run the app on it:
//
//   LIBRARY_PATH=<out.json> npm run dev -- --port 5180
//
// (another port is another origin, so its IndexedDB copy is separate too).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mockLibrary } from "../src/lib/mock.ts";
import { parseLibraryFile, serializeLibraryFile } from "../src/lib/serialize.ts";

const [out, count = "3000", coversFrom] = process.argv.slice(2);
if (!out) throw new Error("Usage: node scripts/mock-library.ts <out.json> [albums] [covers-from.json]");
if (existsSync(out)) throw new Error(`${out} already exists`);

const covers = coversFrom
  ? parseLibraryFile(readFileSync(coversFrom, "utf8")).albums.flatMap((a) => a.cover ?? [])
  : [];
const text = serializeLibraryFile(mockLibrary({ albums: Number(count), covers }));
parseLibraryFile(text);
writeFileSync(out, text);
console.log(`${count} albums written to ${out}`);
