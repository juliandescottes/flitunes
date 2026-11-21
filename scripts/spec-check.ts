// Spec coverage check.
//
// Every claim in docs/specs/<spec>.md starts with an id in inline code,
// either as a bullet ("- `browsing.search` ...") or as the first cell of a
// table row ("| `browsing.sort-year` | ..."). Ids are scoped by spec: the
// part before the first dot is the spec file name.
//
// Playwright tests reference ids with tags: { tag: ["@browsing.search"] }.
//
// Fails on duplicate or badly scoped ids, and on tests referencing ids that
// don't exist. Lists the ids that no test references (the test gaps).
//
// Known gaps are recorded in docs/specs/untested.txt, and the list may only
// shrink: the check fails when a claim is untested but not in the file (a
// new gap), and when the file lists a claim that is now tested or no longer
// exists.
//
//   node scripts/spec-check.ts [--quiet] [--update-baseline]
//
//   --quiet            don't list untested ids, only print their count.
//   --update-baseline  rewrite docs/specs/untested.txt with the current gaps.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SPECS_DIR = join(ROOT, "docs/specs");
const TESTS_DIR = join(ROOT, "tests/e2e");
const BASELINE = join(SPECS_DIR, "untested.txt");
const BASELINE_HEADER = [
  "# Spec claims without a test, checked by `npm run spec-check`.",
  "# This list may only shrink. When you add a test for a claim, remove its",
  "# id. A new claim without a test must be added here on purpose; run",
  "# `npm run spec-check -- --update-baseline` to rewrite the list.",
];

const ID = "[a-z0-9-]+(?:\\.[a-z0-9-]+)+";
const CLAIM_RE = new RegExp("^\\s*(?:- |\\| )`(" + ID + ")`");
const TAG_RE = new RegExp("['\"`]@(" + ID + ")['\"`]", "g");

const quiet = process.argv.includes("--quiet");
const updateBaseline = process.argv.includes("--update-baseline");
const errors: string[] = [];

const rel = (file: string) => relative(ROOT, file);

function listFiles(dir: string, filter: (file: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "tmp" ? [] : listFiles(file, filter);
    return filter(file) ? [file] : [];
  });
}

// The claim ids declared in the specs.
const claims = new Map<string, string>(); // id -> "file:line"
const specFiles = readdirSync(SPECS_DIR)
  .filter((name) => name.endsWith(".md") && name !== "README.md")
  .map((name) => join(SPECS_DIR, name));

for (const file of specFiles) {
  const spec = basename(file, ".md");
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      const match = CLAIM_RE.exec(line);
      if (!match) return;
      const id = match[1];
      const location = `${rel(file)}:${index + 1}`;
      if (id.split(".")[0] !== spec) errors.push(`${location}: id \`${id}\` should start with "${spec}."`);
      if (claims.has(id)) {
        errors.push(`${location}: duplicate id \`${id}\` (first at ${claims.get(id)})`);
        return;
      }
      claims.set(id, location);
    });
}

// The ids referenced by test tags.
const tested = new Set<string>();
for (const file of listFiles(TESTS_DIR, (f) => f.endsWith(".ts"))) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      for (const match of line.matchAll(TAG_RE)) {
        const id = match[1];
        if (!claims.has(id)) {
          errors.push(`${rel(file)}:${index + 1}: unknown spec id @${id}`);
          continue;
        }
        tested.add(id);
      }
    });
}

// Report.
const untested = [...claims.keys()].filter((id) => !tested.has(id));
console.log(`${claims.size} spec claims, ${tested.size} referenced by tests, ${untested.length} untested.`);
if (!quiet && untested.length) {
  console.log("\nUntested claims:");
  for (const id of untested) console.log(`  ${id}  (${claims.get(id)})`);
}

// Compare the gaps with the baseline.
if (updateBaseline) {
  writeFileSync(BASELINE, [...BASELINE_HEADER, ...untested.sort()].join("\n") + "\n");
  console.log(`\nWrote ${rel(BASELINE)}.`);
} else {
  const baseline = existsSync(BASELINE)
    ? readFileSync(BASELINE, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
    : [];
  const listed = new Set(baseline);
  for (const id of untested) {
    if (!listed.has(id)) {
      errors.push(
        `new test gap: \`${id}\` (${claims.get(id)}) has no test. ` +
          `Tag a test with @${id}, or add the id to ${rel(BASELINE)}.`,
      );
    }
  }
  for (const id of baseline) {
    if (!claims.has(id)) errors.push(`${rel(BASELINE)}: \`${id}\` is not a spec claim anymore, remove it.`);
    else if (tested.has(id)) errors.push(`${rel(BASELINE)}: \`${id}\` is now tested, remove it.`);
  }
}

if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}
