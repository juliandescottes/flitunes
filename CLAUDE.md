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
[flitunes-library](https://github.com/juliandescottes/flitunes-library).
`npm run dev` reads and writes a clone of it next to this repo
(`../flitunes-library/library.json`, or the path in `LIBRARY_PATH`).
Curate locally, Save, then commit and push in the data repo.

`scripts/spotify-history/` builds albums from a Spotify listening history
export and adds them for review in the Triage source (see its README).

Every push to `main` deploys the app to GitHub Pages
(`.github/workflows/pages.yml`). The site fetches the library from the data
repo (`VITE_LIBRARY_URL`) when it opens, so library pushes need no redeploy
(GitHub caches the file for a few minutes). Edits made on the site stay in
that browser until Save commits `library.json` to the data repo through the
GitHub API, with a token pasted once per browser (`src/lib/github.ts`).

## Testing in the browser

Check UI changes live in a browser (e.g. with firefox-devtools-mcp), not only
with unit tests.

- Use another port, a mock library and a fake Spotify client ID, so the real
  library, the user's dev server (port 5173) and their Spotify account are
  never touched: `node scripts/mock-library.ts <scratch>/mock.json`, then
  `LIBRARY_PATH=<scratch>/mock.json VITE_SPOTIFY_CLIENT_ID=fake-client npx vite
  --port 5182 --strictPort`. The variable on the command line wins over
  `.env.local`, which holds the real ID. Start it once and leave it running for
  the session (Vite reloads code changes); reuse it if port 5182 is already in
  use, but only if `ps` shows it was started with the fake ID.
- Never play on the user's Spotify account from a test.
- Views that need a Spotify sign-in (e.g. `AlbumTracks.svelte`) can't be
  reached by faking the session: with fake tokens in `localStorage`, the first
  poll runs before a `fetch` stub can be installed, gets a 401 and signs out.
  Mount the component directly from the browser tool instead, with props
  standing in for Spotify (take the `svelte.js` URL from `/src/main.ts`):

  ```js
  const { mount } = await import("/node_modules/.vite/deps/svelte.js?v=…");
  const { default: AlbumTracks } = await import("/src/components/AlbumTracks.svelte");
  mount(AlbumTracks, { target, props: { album, load: () => new Promise(() => {}), … } });
  ```

## Workflow

Fixes and features go through a pull request, not a direct commit to `main`.
Work on a branch and commit there. The user pushes the branch and opens the
PR. The PR description is the project's decision record (what changed, why,
which alternatives were set aside): draft it in the chat for the user, in a
fenced code block so it copies cleanly, in a professional tone (product
reasons, not personal habits or feelings).
For a question that needs discussing, draft an issue for the user to file.

Changes that only touch Markdown docs (`STATUS.md`, `PLAN.md`, `CLAUDE.md`,
`docs/`) are committed straight to `main`, without a branch or PR.

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
- `src/lib/github.ts`: the site's `LibrarySource` when the library URL is on
  GitHub. With a token (fine-grained, `localStorage`), it reads `library.json`
  through the API and Save commits it, naming the blob sha it read; a changed
  file is a `SaveConflict`, which the store turns into the usual conflict when
  the file is newer than the local copy's base.
- `src/lib/spotify-auth.ts`, `spotify-session.svelte.ts`, `spotify-player.svelte.ts`,
  `spotify-tracks.ts`: optional Spotify sign-in (PKCE), Web API calls, playback
  (now playing is polled every 5 s while the page is visible), and album track
  lists for `AlbumTracks.svelte` (cached for the session, never saved).
- `vite-plugins/library-file.ts`: dev-only `GET/POST /__library` endpoint that
  reads and writes the library file in the data repo clone, `GET
  /__library/covers/<file>` for stored covers, and `POST /__library/covers`
  to copy a cover URL into `covers/`. POSTs are accepted only from the same
  origin as JSON.

## Conventions

- Relative imports use explicit `.ts` extensions (needed by Vite's native config loader).
- Store arrays use `$state.raw`: replace them, never mutate in place
  (proxies can't be stored in IndexedDB).
- Album objects always carry every field. Optional values are `null`, not
  missing, so that `library.json` keeps a stable shape.
- Genres are a flat, curated list, referenced by slug id. The first genre on an album is the primary one.
- One album entry per edition. Compilations use the artist `"Various Artists"` (`VARIOUS_ARTISTS`).
- A cover is a file in the library repo's `covers/` folder (`"covers/<album id>.jpg"`,
  resolved next to `library.json` by `coverSrc` in `persistence.ts`) or an `https:` URL.
  New covers come in as URLs: in dev, the store copies them into `covers/` right away
  (`POST /__library/covers`); covers added on the site stay URLs until `scripts/covers/`
  brings them in. No image files in the app repo.
- `library.json` is validated strictly, on load and on every edit (`isValidCover`,
  `isValidSpotifyUri` in `model.ts`), so a saved file always loads again.
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
