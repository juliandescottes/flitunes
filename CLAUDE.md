# Album Library

Personal, single-user web app to curate a music album library by hand
(iTunes 10-style browsing by artist, genre, tags, as a UI reference only) and open albums in Spotify.
Spotify is only a link, never the source of truth.

- Spec & design: `docs/spec.md`
- Roadmap: `PLAN.md`
- Current state / next step: `STATUS.md` (update it at the end of each work session)

## Commands

```sh
npm run dev      # dev server at http://127.0.0.1:5173 (loopback IP, not localhost)
npm test         # vitest (unit tests, fake-indexeddb)
npm run check    # svelte-check (types)
npm run build    # static build in dist/ (includes a copy of library.json)
```

Run `npm test` and `npm run check` before committing.

Every push to `main` deploys the build to GitHub Pages
(`.github/workflows/pages.yml`). The site is a viewer of the committed
`data/library.json`: edits made there stay in that browser and Save downloads
the file. Curate locally with `npm run dev`, then push.

## Workflow

Fixes and features go through a pull request, not a direct commit to `main`:
work on a branch, then open the PR with `gh pr create`. The description is the
project's decision record: say what changed, why, and which alternatives
were set aside. Open an issue first for a question that needs discussing,
and link it from the PR. The user reviews and merges.

## Architecture

Static Svelte 5 + Vite + TypeScript app, no backend.

- `src/lib/model.ts`: types (`Album`, `Genre`, `LibraryFile`) and helpers.
- `src/lib/serialize.ts`: `library.json` parse/validate/serialize. The output
  is deterministic (sorted ids, fixed key order, sorted tags) so diffs stay small.
- `src/lib/db.ts`: Dexie (IndexedDB) schema, the working copy of the library.
- `src/lib/library.svelte.ts`: reactive `Library` store. All mutations go
  through it: it writes IndexedDB, bumps the unsaved-changes counter, and
  handles loading or conflicts against `library.json`.
- `src/lib/persistence.ts`: `LibrarySource` (fetch/save `library.json`) and JSON download.
- `vite-plugins/library-file.ts`: dev-only `GET/POST /__library` endpoint that
  reads and writes `data/library.json`. The POST is validated and accepted only
  from the same origin as JSON.
- `data/library.json`: the durable, committed copy of the library. The user's data.

## Conventions

- Relative imports use explicit `.ts` extensions (needed by Vite's native config loader).
- Store arrays use `$state.raw`: replace them, never mutate in place
  (proxies can't be stored in IndexedDB).
- Album objects always carry every field. Optional values are `null`, not
  missing, so that `library.json` keeps a stable shape.
- Genres are a flat, curated list, referenced by slug id. The first genre on an album is the primary one.
- One album entry per edition. Compilations use the artist `"Various Artists"` (`VARIOUS_ARTISTS`).
- Covers are stored as URLs only. No image files in the repo.
- Everything is hand curated. The only external lookup is Spotify oEmbed (title +
  cover from a pasted link). No metadata services (iTunes, MusicBrainz, …), no
  Spotify login or Web API.
- Keep the store testable: inject `LibraryDB` and `LibrarySource`, and test with
  `fake-indexeddb` and an in-memory source (see `src/lib/library.test.ts`).

## Gotchas

- TypeScript is pinned to 6.x because `svelte-check` doesn't support 7 yet.
- `data/` is excluded from the Vite watcher so saving the library doesn't reload the page.
- Don't hand-edit `data/library.json` while the app has unsaved changes. The app
  will detect a newer file and ask which one to keep.
- Never overwrite or reset `data/library.json` in tests or scripts. Back it up
  first if you need to exercise the endpoint manually.
