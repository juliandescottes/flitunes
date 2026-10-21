# Albums from your Spotify listening history

Turns Spotify's "Extended streaming history" (every play since you joined)
into the albums you actually listened to, then adds them to your
`library.json` for review in the app's **Triage** source.

It runs in three steps, with your library repo cloned next to this one:

```sh
# 1-3. Count listens, find each album on Spotify, write a CSV (run from the app repo)
node scripts/spotify-history/history.ts <export-dir> ../flitunes-library/library.json <work-dir>

# 4. Add the CSV's albums to the library, tagged "triage" (dry run, then --write)
node scripts/spotify-history/add-triage.ts ../flitunes-library/library.json <work-dir>/history-albums.csv
node scripts/spotify-history/add-triage.ts ../flitunes-library/library.json <work-dir>/history-albums.csv --write

# 5. In the app (npm run dev): Triage, sorted by Date Added, newest first
```

Keep `<work-dir>` outside the repos, or in a git-ignored folder: it holds
your listening data.

## Getting the export

On spotify.com: Account → Privacy settings → Download your data → tick
**Extended streaming history** (not "Account data"). Spotify emails a link
within a few days to a few weeks. Unzip it: the folder with the
`Streaming_History_Audio_*.json` files is `<export-dir>`. Video files and the
PDF are ignored.

**Privacy.** The files also hold IP addresses, devices and countries. The
scripts read only the time, duration, album artist, album name and track URI
of each play, and send nothing but track and album ids to Spotify.

## 1-3. history.ts

1. **Listens.** A play of 30 seconds or more counts. Listens are added up per
   (album artist, album name), and a pair is kept with 10 listens or more over
   3 distinct tracks or more (`--min-plays`, `--min-tracks`): a song replayed
   from a playlist isn't an album you listened to. Podcasts and audiobooks are
   skipped. `--offline` stops here, to try thresholds.
2. **Spotify albums.** The export has album names, not album ids, so each
   pair's most played track is looked up on Spotify's public pages:
   `open.spotify.com/track/<id>` gives the album link, and the album page gives
   its title, artist, type, year, track count and 640px cover (from the
   pages' `<meta>` tags).
3. **CSV.** Pairs resolving to the same album are merged (plays added up).
   Albums already in the library are skipped, by Spotify link or by artist and
   title (the app's `albumMatchKey`). Compilations get the artist "Various
   Artists" (the app's convention); edition notes in brackets ("(Remastered
   2011)") are removed from titles. `<work-dir>/history-albums.csv` lists the
   rest, most played first, with the columns `artist, album, year, plays,
   spotify, cover, type, tracks_played, total_tracks, first_played,
   last_played, spotify_artist`. The app's Import CSV sheet can read it too,
   for small lists.

**Being gentle with Spotify.** Step 2 makes one request at a time, 1.6 s
apart, with a User-Agent naming this project; about two requests per album,
so roughly an hour per 1,000 albums. Spotify's Web API isn't used: it allows
only a few hundred calls a day. Note that Spotify's terms of use don't allow
scraping its service: this reads two public pages per album, once, for your
own listening history.

**Resuming.** Every result goes to `<work-dir>/history-albums.jsonl` as soon
as it's known; run the same command again to go on where it stopped. It stops
by itself (exit code 2) if Spotify answers `429` with a long `Retry-After`,
or refuses pages twice in a row: wait and re-run. `--limit N` resolves at
most N albums per run.

**Keep the computer awake.** A laptop going to sleep pauses the run for as
long as it sleeps. On a Mac, run it under `caffeinate -i` and keep the lid
open.

## 4. add-triage.ts

Adds every CSV row not already in the library, tagged `triage`:

- with its Spotify link, cover and year;
- with the listening stats in its notes ("Spotify history: 1,227 plays,
  45/45 tracks, 2014-03-02 to 2025-11-30.");
- dated a second apart in play order, so Triage sorted by **Date Added**,
  newest first, lists the most played first.

Two editions of one album (same artist and title, e.g. a remaster) become one
entry: the most played, with the other's link in its notes. Compilations are
compared by Spotify's own artist, so "Greatest Hits" by two bands stay two
albums. `--drop-artist NAME` (repeatable) leaves an artist out, e.g. sleep or
white-noise "albums".

Without `--write`, it only reports. With it, the library is backed up next to
the CSV first. **Save in the app before** (no unsaved changes), and reload it
after.

## 5. Triage in the app

Triage albums show only in the Triage source, not in the rest of the library.
**Accept** (button, ⌘↩, or the context menu) keeps the album, **Delete**
rejects it. Worth checking while you go:

- **Single-artist compilations.** Spotify calls many best-ofs (and some
  albums) compilations, so they arrive as "Various Artists". Their notes say
  "Spotify lists it as a compilation by …": fix the artist in Get Info.
- **Songs, not albums.** `tracks_played` against `total_tracks` in the notes
  shows how much of the album you played (a long soundtrack you took a few
  songs from, say). Counts can exceed the album's: Spotify relinks the same
  song across editions.

**Re-running** later (a newer export) adds what's new, but it also brings back
the albums you deleted during triage, since nothing remembers them. Pass a
newer export with a fresh `<work-dir>`, and check the dry run's list.
