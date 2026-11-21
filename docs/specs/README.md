# Feature specs

One file per feature area, describing how FliTunes behaves **today**. Specs
are the reference for "what is the intended behavior?" when fixing a bug,
reviewing a change, or writing a test. `docs/spec.md` is the design
document (why, principles, roadmap); these files say what the app does.

- A change that alters user-facing behavior updates the matching spec in
  the same commit.
- A spec describes behavior, not implementation. It doesn't point to
  code.
- If code and spec disagree, figure out which one is wrong. Don't silently
  "fix" either one: if unsure, ask.
- Every claim has an id, and e2e tests reference the ids they verify (see
  [Claim ids](#claim-ids)).
- The e2e tests for `<spec>.md` live in `tests/e2e/<spec>/`. Tests of the
  static site (saving to GitHub) are named `*.site.spec.ts`: they run
  against a build of the site, with GitHub faked.

## Index

| Spec | Covers |
| --- | --- |
| [browsing.md](browsing.md) | Sources, column browser, search, link filter, views, sorting, selection, type-ahead |
| [album-editing.md](album-editing.md) | Get Info (one album, several albums), genre and playlist chips, ratings, deleting albums |
| [adding-albums.md](adding-albums.md) | Add to Library, Add Several, Import CSV |
| [triage.md](triage.md) | Reviewing imported albums: accept or delete |
| [genres.md](genres.md) | Renaming, merging and deleting genres |
| [save-and-sync.md](save-and-sync.md) | Unsaved changes, Save, Export, Import, newer `library.json`, saving to GitHub from the site |
| [spotify.md](spotify.md) | Sign-in, playback, devices, the display while playing, album tracks |
| [navigation.md](navigation.md) | The address, Back and Forward |
| [themes.md](themes.md) | Color themes |

## Claim ids

Each claim in a spec, meaning each bullet or table row in "Behavior", starts
with an id in inline code:

```markdown
- `browsing.search` Every word typed must appear in the album's title, …

| Claim | Column | Behavior |
| --- | --- | --- |
| `browsing.sort-year` | Year | … |
```

- An id is `<spec>.<name>`: the spec file name, a dot, then a short
  kebab-case name. Keep ids stable; rename one only together with the
  tests that reference it.
- A claim states a rule; several tests can exercise it. If a claim maps
  one-to-one onto a single test title, it is probably too fine. Split a
  rule out only when it needs to be reported on its own, typically because
  it is untested while the rest is.
- No scenario detail in specs ("a pick no longer listed falls back to All",
  not "searching for 'blue' after picking Jazz gives …"). Scenarios belong
  in tests, and tests don't restate the spec: the tag points to the claim.
- A Playwright test lists the claims it verifies as tags:
  `test('...', { tag: ['@browsing.search'] }, async ({ page }) => ...)`.
  Only tag a claim the test actually asserts. A test can reference claims
  from any spec.
- `npm run spec-check` fails on duplicate ids, ids that don't match their
  file, and tags referencing unknown ids. It lists the claims no test
  references: these are the test gaps, so specs don't list them by hand.
- Known gaps are recorded in [untested.txt](untested.txt), and that list
  may only shrink. `spec-check` fails on a new gap (a claim with no test
  that isn't listed) and on a listed claim that is now tested or no longer
  exists. When a new claim can't be tested yet, add its id to the list in
  the same change, so the gap is visible in review.
  `npm run spec-check -- --update-baseline` rewrites the list.
- `npx playwright test --grep @browsing.search` runs the tests for a claim.
  `--grep` is a regular expression, so this also matches ids that start
  with the same text, such as `browsing.search-focus`.

## Template

Copy this for a new spec. Keep sections that don't apply, with "None".

```markdown
# <Feature area>

## Purpose
One or two sentences: what this lets the user do, and why.

## Behavior
What the user can do and what happens. One claim per bullet, each
starting with its id, grouped by sub-feature. Include defaults, limits,
modifier keys and edge cases (empty library, one album, compilations,
albums without a link, ...).

- `<spec>.<name>` A single, testable statement.

## UI and shortcuts
Where the feature lives in the UI, and its default shortcuts.
```

## Conventions

- Specs cover the app as users see it. Build tooling, storage keys and
  the `library.json` format are described in `CLAUDE.md` and
  `docs/spec.md` instead.
- `⌘` means Cmd on macOS and Ctrl elsewhere.
- Mark anything uncertain with _(to confirm)_ rather than guessing.
