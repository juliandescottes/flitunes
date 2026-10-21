# FliTunes

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
npm run build    # static build in dist/
```

Run `npm test` and `npm run check` before committing.

Spotify sign-in (optional) needs the client ID of a Spotify app: put
`VITE_SPOTIFY_CLIENT_ID=<id>` in `.env.local` (git-ignored) for dev. The
Pages build reads it from the repository variable `SPOTIFY_CLIENT_ID`.

The library is content, not code: `library.json` lives in its own repo,
[spotify-viewer-album-library](https://github.com/juliandescottes/spotify-viewer-album-library).
`npm run dev` reads and writes a clone of it next to this repo
(`../spotify-viewer-album-library/library.json`, or the path in `LIBRARY_PATH`).
Curate locally, Save, then commit and push in the data repo.

Every push to `main` deploys the app to GitHub Pages
(`.github/workflows/pages.yml`). The site fetches the library from the data
repo (`VITE_LIBRARY_URL`) when it opens, so library pushes need no redeploy
(GitHub caches the file for a few minutes). Edits made on the site stay in
that browser, and Save downloads the file.

## Testing in the browser

Check UI changes live in a browser (e.g. with firefox-devtools-mcp), not only
with unit tests.

- Use another port and a mock library, so the real library and the user's dev
  server (port 5173) are never touched: `node scripts/mock-library.ts
  <scratch>/mock.json`, then `LIBRARY_PATH=<scratch>/mock.json npx vite --port
  5182 --strictPort`. Start it once and leave it running for the session
  (Vite reloads code changes); reuse it if port 5182 is already in use.
- Never play on the user's Spotify account from a test: use a fake
  `VITE_SPOTIFY_CLIENT_ID` and stub `fetch`.

## Workflow

Fixes and features go through a pull request, not a direct commit to `main`.
Work on a branch and commit there. The user pushes the branch and opens the
PR. The PR description is the project's decision record (what changed, why,
which alternatives were set aside): draft it in the chat for the user.
For a question that needs discussing, draft an issue for the user to file.

Never push, open PRs, create issues or comment on GitHub unless the user
asks for that specific action: all of it is posted under the user's name.

## Architecture

Static Svelte 5 + Vite + TypeScript app, no backend.

- `src/lib/model.ts`: types (`Album`, `Genre`, `LibraryFile`) and helpers.
- `src/lib/serialize.ts`: `library.json` parse/validate/serialize. The output
  is deterministic (sorted ids, fixed key order, sorted tags) so diffs stay small.
- `src/lib/db.ts`: Dexie (IndexedDB) schema, the working copy of the library.
- `src/lib/library.svelte.ts`: reactive `Library` store. All mutations go
  through it: it writes IndexedDB, bumps the unsaved-changes counter, and
  handles loading or conflicts against `library.json`.
- `src/lib/route.ts`: where the main view is (source, column picks, search,
  tracks) as the URL hash, so Back and Forward work. Preferences (view, sort)
  and the selection stay out of it.
- `src/lib/persistence.ts`: `LibrarySource` (fetch/save `library.json`) and JSON download.
- `src/lib/spotify-auth.ts`, `spotify-session.svelte.ts`, `spotify-player.svelte.ts`,
  `spotify-tracks.ts`: optional Spotify sign-in (PKCE), Web API calls, playback
  (now playing is polled every 5 s while the page is visible), and album track
  lists for `AlbumTracks.svelte` (cached for the session, never saved).
- `vite-plugins/library-file.ts`: dev-only `GET/POST /__library` endpoint that
  reads and writes the library file in the data repo clone. The POST is
  validated and accepted only from the same origin as JSON.

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
  cover from a pasted link). No metadata services (iTunes, MusicBrainz, …).
- Signing in to Spotify is optional and only for playback (Web API, OAuth PKCE in
  the browser, `src/lib/spotify-auth.ts`). Spotify data shown while signed in (now
  playing, track lists) is fetched live and never saved to the library. Without a
  client ID (`VITE_SPOTIFY_CLIENT_ID`), the feature is hidden and albums are plain links.
- Keep the store testable: inject `LibraryDB` and `LibrarySource`, and test with
  `fake-indexeddb` and an in-memory source (see `src/lib/library.test.ts`).

## Gotchas

- TypeScript is pinned to 6.x because `svelte-check` doesn't support 7 yet.
- The library file is excluded from the Vite watcher so saving it doesn't reload the page.
- Don't hand-edit `library.json` while the app has unsaved changes. The app
  will detect a newer file and ask which one to keep.
- Never overwrite or reset `library.json` (in the data repo) in tests or scripts. Back it up
  first if you need to exercise the endpoint manually.
