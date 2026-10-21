# FliTunes

Hand curated music library focused on albums, in the look of old iTunes versions.
browse by genre, artist and album, rate, tag albums into playlists, and open
them in Spotify. Optionally, sign in to Spotify to control playback and see
album tracks.

FliTunes is a static web app with no backend. Your library is one JSON file,
`library.json`, kept in its own GitHub repository. Spotify is only a link: the
library never depends on it.

## Run your own FliTunes

Each person runs their own copy: their own site, their own library and, for
playback, their own Spotify app. You need a GitHub account and, to curate
locally, [Node.js](https://nodejs.org/) 24 or later.

### 1. Fork the app

1. Fork this repository on GitHub. Keeping the name `spotify-album-viewer`
   gives your site the same path as this one.
2. In your fork, open the **Actions** tab and enable workflows (GitHub turns
   them off on forks).
3. In **Settings → Pages**, set **Source** to **GitHub Actions**.

### 2. Create your library repository

1. Create a **public** repository named `spotify-viewer-album-library`. It
   can start empty. The site reads `library.json` from it, so it has to be
   public.
2. To use another name, add a repository variable to your app fork
   (**Settings → Secrets and variables → Actions → Variables**):
   `LIBRARY_URL` = `https://raw.githubusercontent.com/<you>/<repo>/main/library.json`.

### 3. Curate locally

Clone both repositories side by side:

```sh
git clone https://github.com/<you>/spotify-album-viewer
git clone https://github.com/<you>/spotify-viewer-album-library
cd spotify-album-viewer
npm install
npm run dev
```

Open <http://127.0.0.1:5173/>. The library starts empty:
- **+ Add Album(s)** takes a Spotify album link and fills in the title and
  cover. You can also add an album by hand, or several at once, or import a CSV.
- **Save** (⌘S) writes `../spotify-viewer-album-library/library.json`. To
  keep it elsewhere, start the dev server with
  `LIBRARY_PATH=<path to library.json> npm run dev`.

Then publish the library:

```sh
cd ../spotify-viewer-album-library
git add library.json
git commit -m "Add albums"
git push
```

### 4. Publish the site

Push anything to `main` in your app fork, or run the **Deploy to GitHub
Pages** workflow from the Actions tab. The site is at
`https://<you>.github.io/spotify-album-viewer/`.

The site fetches `library.json` when it opens, so a library push shows up
without redeploying (after a few minutes of GitHub caching). Edits made on
the site stay in that browser. **Export** downloads the file, which you can
commit to the library repository.

### 5. Spotify playback (optional)

Without this step, albums open in the Spotify app. With it, FliTunes gets
play/pause, previous/next, a device menu and album track lists.

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard),
   with the **Web API**. Its owner needs Spotify Premium.
2. Add two redirect URIs, exactly:
   - `http://127.0.0.1:5173/`
   - `https://<you>.github.io/spotify-album-viewer/`
3. Copy the app's **Client ID** (no secret is needed):
   - for the dev server, put `VITE_SPOTIFY_CLIENT_ID=<client id>` in
     `.env.local` in the app folder (ignored by git);
   - for the site, add a repository variable `SPOTIFY_CLIENT_ID` to your app
     fork, then redeploy.
4. A new Spotify app is in development mode: only accounts you add under
   **User Management** can sign in (up to 5).

Then use the Spotify toggle (sound waves) in the toolbar to connect.

### Getting updates

On GitHub, **Sync fork** in your app fork brings in new versions, and the
next deploy publishes them. Your library is in its own repository, so
syncing never touches it.

## Development

```sh
npm run dev      # dev server at http://127.0.0.1:5173
npm test         # unit tests
npm run check    # type checks
npm run build    # static build in dist/
```

The spec and design notes are in [`docs/spec.md`](docs/spec.md).

## License

[MIT](LICENSE). The look follows iTunes 10 as a design reference only: no
Apple code, artwork or data is included.

FliTunes is not affiliated with or endorsed by Apple or Spotify. iTunes is a
trademark of Apple Inc. Spotify is a trademark of Spotify AB.
