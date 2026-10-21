# Covers kept with the library

Copies each album's cover from its URL (usually Spotify's image servers) into
a `covers/` folder next to `library.json`, and points the album at its file:
`"cover": "covers/<album id>.jpg"`. The library then shows its covers even if
an album or its image goes away on Spotify.

```sh
# Download the covers (resumable: run it again after a stop), library.json untouched
node scripts/covers/covers.ts ../flitunes-library/library.json

# Then point the albums at their files
node scripts/covers/covers.ts ../flitunes-library/library.json --write
```

Save in the app first: with `--write`, the app must have no unsaved changes.
`--limit N` downloads at most N covers per run. A cover that fails to download
(dead URL, not an image) keeps its URL and is listed at the end.

Then commit `covers/` and `library.json` in the library repo. The app finds
`covers/` files next to `library.json`: from the clone in dev (served by the
dev server), and next to `VITE_LIBRARY_URL` on the site.

In dev, covers added later (Add Album, Add Several, Get Info) are copied
into `covers/` right away by the dev server. Covers added on the site stay
URLs: run the script now and then to bring them in.
