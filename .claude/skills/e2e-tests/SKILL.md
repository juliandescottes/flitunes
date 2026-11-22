---
name: e2e-tests
description: Rules for writing, improving and reviewing FliTunes' Playwright e2e tests (tests/e2e) and the specs they verify (docs/specs). Use this whenever adding or changing a *.spec.ts test, changing user-facing behavior, covering a claim from docs/specs/untested.txt, fixing a flaky e2e test, or reviewing e2e test code, even if the request only says "add a test" or "cover this spec".
---

# FliTunes e2e tests

Follow this for all three kinds of work:

- **Writing:** pick the claims, read the code behind them, write the tests, then run them.
- **Improving:** keep what the test verifies and bring it in line with the rules below.
- **Reviewing:** report where a test breaks a rule or could pass while the behavior is broken. Give the file, the line and a concrete fix.

The e2e tests are the main safety net. Unit tests (`src/**/*.test.ts`, Vitest) stay for logic that is pure and hard to reach from the UI: the `library.json` format, validators, the route parser, Spotify auth, GitHub conflicts.

## Readability

An e2e test should be easy for a human to read. Someone new to the test should quickly see what it sets up, what it does and what it expects, because that's how they tell whether a failure is a bug in the app or in the test. When a shorter or cleverer version would be harder to follow, prefer the clearer one.

Each test should read like very simple instructions about what the user is doing. If a step is a convoluted expression or takes too many lines, first check whether `tests/e2e/testutils.ts` already has a helper for it. If not, add one there with a user-friendly, descriptive name, so the test tells a story:

```ts
// Instead of
await page.locator("tr[data-id]").filter({ hasText: "Apollo" }).locator("td.artist").click({ modifiers: ["Shift"] });
// write
await clickAlbum(page, "Apollo", ["Shift"]);
```

Add a comment for each high-level user step, so the test reads as a scenario from top to bottom:

```ts
// Jazz by Miles Davis.
await pickInColumn(page, "Artists", "Miles Davis");
await assertColumn(page, "Albums", ["All (2 Albums)", "Bitches Brew", "Kind of Blue"]);
```

## Specs

- Tests for `docs/specs/<spec>.md` live in `tests/e2e/<spec>/`.
- Every e2e test references at least one spec claim, using a tag for each claim it verifies: `{ tag: ["@browsing.search"] }`. Only tag a claim the test actually asserts. `spec-check` doesn't catch a missing tag, so check this yourself.
- A change to user-facing behavior updates the spec in the same commit. A new claim gets a test, or its id goes in `docs/specs/untested.txt` on purpose.
- When a claim gets its first test, remove its id from `docs/specs/untested.txt`. Run `npm run spec-check` to confirm.
- If the code and the spec disagree, ask which one is wrong rather than writing the test to match either.

## Fixtures

- Each test file declares its library at the top with `album()` and `genre()`, and opens the app on it with `openApp(page, library)`. The library is served by intercepting `/__library`, and each test gets a fresh browser context, so IndexedDB starts empty. `openApp` returns the files the app saved, for tests about Save.
- Use real-looking albums (artist, title, year), a handful per library, and only the fields the test needs. Use `daysAgo(n)` for dates added.
- Pick data that tells the rule apart from a plausible bug: if breaking the rule wouldn't change the result, the test can't fail. "cafe" matches an unfolded "Café" anyway (NFKD splits the accent off), so the accent test searches "francoise" for "Françoise".
- Never touch the real library, the user's dev server (port 5173) or their Spotify account. The config runs its own server on port 5183 with a fake Spotify client ID and a library path that doesn't exist, and requests to other sites fail unless a test fakes them.
- Fake Spotify and GitHub with the helpers rather than new `page.route` code: `FakeSpotify` and `signInToSpotify` in `spotify.ts`, `fakeOembed` in `testutils.ts`, `FakeGitHub` and `openSite` in `github.ts` (for `*.site.spec.ts` tests, which run against a build of the site). Extend them when a test needs more.

## Interacting with the app

- Act and read through the UI, as a user would, so tests survive internal refactors.
- Find elements by role and accessible name (`getByRole`, `getByLabel`): the app is meant to be accessible, and a test that can't find an element this way often points to a real accessibility gap. When a name is missing, add an `aria-label` to the component rather than a test-only attribute. Class selectors are a last resort and stay inside `testutils.ts` helpers (the display, the Get Info title bar).
- Mouse down is what selects in the list and the columns, and the Rating cell's stars stop it: click an album on its Artist cell (`clickAlbum`).
- Answer `confirm()` with `answerConfirm(page)`, started before the action, and check its message.
- Before a keyboard shortcut, put the focus where the user's would be (`focusMainView`, `clickAlbum`): a button you just clicked keeps the focus, and `Enter` would press it instead of reaching the shortcut.
- When a test uses modifier keys, say what each one does in a comment. Use `ControlOrMeta` for `⌘`.

## Asserting

- Assert whole lists, in order, rather than one item: `assertShownAlbums(page, ["Moon Safari", "Apollo"])`, `assertColumn`, `assertSources`, `assertChips`. Stray or missing albums then fail the test, and the reader sees the whole state.
- Work out expected values by hand, from the spec. When the order depends on sorting, say why in a comment (`// Sorted by artist: Air, Can, Coltrane.`). Output copied from a run only proves the code does what it does.
- Assert the state after each setup step, so a broken setup fails at the step that caused it.
- When an action has effects elsewhere in the app, check those as well as the local change, because a field keeping its value doesn't prove the edit was applied:
  - After editing in Get Info, check the list row, the column browser or the sources, not only the form.
  - After a change that is saved locally, reload and check it's still there.
  - When something should stay unchanged (the other albums, an unticked field), check that too.
- Make sure a test can fail. For "does nothing" claims, check that no side effect happened. For limits and timing, break the behavior and confirm the test fails.

## Timing

- Prefer polling (`expect(locator)`, `expect.poll`) over fixed waits.
- Type-ahead groups letters typed within a second (`browsing.type-ahead`): wait 1100 ms to start over.

## Running

- `npm run e2e` runs everything; `npx playwright test --grep @browsing.search` runs a claim's tests.
- Check new or changed tests with:

  ```sh
  npx playwright test <path> --retries=0 --repeat-each=5
  ```

- Playwright starts its own server on port 5183 and refuses to reuse one: if the port is taken, find out what holds it rather than killing it blindly.
- Report the real result, including any test you didn't run.

## Mutation testing

After writing tests for a claim, break each behavior it covers, one at a time, and confirm a test fails. Restore `src/` after each one and check that `git diff src` is empty. If a mutation isn't caught, either strengthen the test or explain why the mutation couldn't have failed it.

Report progress to the user every 5 mutations, because mutation checks are long runs and the user wants to follow them.

## Adding rules

This skill grows as we write tests. Always ask the user before adding anything to it, even a rule that seems obvious from their feedback, because they decide what becomes a standing rule. Add each approved rule to the section it belongs to, in one or two lines, with the reason when it isn't obvious.
