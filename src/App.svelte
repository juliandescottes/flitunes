<script lang="ts">
  // The iTunes 10 window: toolbar, source list, column browser, list or grid
  // view, and status bar, plus the Add and Get Info windows.
  import { tick } from "svelte";
  import AddAlbum from "./components/AddAlbum.svelte";
  import AddSeveral from "./components/AddSeveral.svelte";
  import ImportCsv from "./components/ImportCsv.svelte";
  import AlbumGrid from "./components/AlbumGrid.svelte";
  import AlbumList from "./components/AlbumList.svelte";
  import AlbumTracks from "./components/AlbumTracks.svelte";
  import ColumnBrowser from "./components/ColumnBrowser.svelte";
  import ContextMenu, { type MenuItem } from "./components/ContextMenu.svelte";
  import GetInfo from "./components/GetInfo.svelte";
  import SourceList from "./components/SourceList.svelte";
  import TopBar from "./components/TopBar.svelte";
  import { browse, genreName, isInTriage, playlists, typeAhead, type SortDir, type SortKey, type Source, type ViewMode } from "./lib/browse.ts";
  import { LibraryDB } from "./lib/db.ts";
  import { parseHash, replacesEntry, routeToHash, type Route } from "./lib/route.ts";
  import { Library } from "./lib/library.svelte.ts";
  import { findGenreByName, TRIAGE_TAG, type Album } from "./lib/model.ts";
  import { downloadLibraryFile, repoSource } from "./lib/persistence.ts";
  import { SpotifyPlayer } from "./lib/spotify-player.svelte.ts";
  import { applyFavicon, applyTheme, THEMES, themeById } from "./lib/themes.ts";
  import { albumTracks, albumYear, hasTrackList } from "./lib/spotify-tracks.ts";
  import { browserSession, safeStorage } from "./lib/spotify-session.svelte.ts";

  const library = new Library(new LibraryDB(), repoSource);
  library.load();

  // Optional Spotify sign-in, for playback control.
  const spotify = browserSession();
  spotify.init(new URLSearchParams(location.search)).then((handled) => {
    if (handled.length === 0) return;
    // Drop Spotify's redirect parameters from the address.
    const url = new URL(location.href);
    for (const name of handled) url.searchParams.delete(name);
    history.replaceState(history.state, "", url);
  });
  const player = new SpotifyPlayer(spotify, Date.now, safeStorage(() => localStorage));

  // View preferences survive reloads (per browser only).
  const PREFS_KEY = "album-library:view";
  const prefs = loadPrefs();

  // Where the main view is (source, column picks, search, tracks) comes from
  // the address, so Back and Forward work (see src/lib/route.ts).
  let shownRoute = parseHash(location.hash);
  let source = $state<Source>(shownRoute.source);
  let search = $state(shownRoute.search);
  let genre = $state<string | null>(shownRoute.genre);
  let artist = $state<string | null>(shownRoute.artist);
  let albumTitle = $state<string | null>(shownRoute.album);
  let sortKey = $state<SortKey>(prefs.sortKey ?? "artist");
  let sortDir = $state<SortDir>(prefs.sortDir ?? "asc");
  let view = $state<ViewMode>(prefs.view ?? "albums");
  let linkedOnly = $state(prefs.linkedOnly === true);
  let theme = $state(themeById(prefs.theme));
  $effect(() => {
    applyTheme(theme);
    applyFavicon(theme);
  });
  let browserHeight = $state(typeof prefs.browserHeight === "number" ? prefs.browserHeight : 160);

  // Selection: ids of the selected albums, the cursor (last clicked or moved
  // to, kept in view) and the anchor that Shift-click extends from.
  let selection = $state.raw<string[]>([]);
  let cursor = $state<string | null>(null);
  let anchor: string | null = null;

  // The album whose tracks the main area shows, instead of the list or grid.
  let tracksFor = $state<string | null>(shownRoute.tracks);
  // Only while signed in: an address with tracks may be opened signed out.
  const tracksAlbum = $derived(
    tracksFor && spotify.status === "signed-in" ? (library.getAlbum(tracksFor) ?? null) : null,
  );

  let addOpen = $state(false);
  // Which form the Add sheet shows.
  let addMode = $state<{ kind: "one" } | { kind: "several"; text: string } | { kind: "csv" }>({ kind: "one" });
  let infoIds = $state.raw<string[]>([]);
  let menu = $state<{ x: number; y: number; items: MenuItem[] } | null>(null);
  let renamingGenre = $state<string | null>(null);
  let error = $state<string | null>(null);

  let fileInput: HTMLInputElement;
  let addSheet: HTMLDialogElement;
  let infoWindow: HTMLDialogElement;
  let main: HTMLDivElement;

  const genreNames = $derived(new Map(library.genres.map((g) => [g.id, g.name])));
  const result = $derived(
    browse(library.albums, library.genres, { source, search, linkedOnly, genre, artist, album: albumTitle, sortKey, sortDir }),
  );
  const triageCount = $derived(library.albums.filter(isInTriage).length);
  const selectedSet = $derived(new Set(selection));
  // Only albums still shown count as selected.
  const selectedAlbums = $derived(result.albums.filter((a) => selectedSet.has(a.id)));
  // The library album that is playing, for the display's "show tracks"
  // button. Matched by what was played (the link FliTunes played), else by
  // the track's album, which Spotify may report as another edition. Only
  // albums have a track list.
  const playingAlbum = $derived.by(() => {
    const playback = player.playback;
    if (!playback?.track) return null;
    const uris = [playback.contextUri, playback.track.albumUri].filter(Boolean);
    const album = uris.map((uri) => library.albums.find((a) => a.spotify === uri)).find(Boolean);
    return album && hasTrackList(album.spotify) ? album : null;
  });
  const infoAlbums = $derived(infoIds.flatMap((id) => library.getAlbum(id) ?? []));
  const infoIndex = $derived(infoIds.length === 1 ? result.albums.findIndex((a) => a.id === infoIds[0]) : -1);

  $effect(() => {
    if (spotify.error) error = spotify.error;
  });

  $effect(() => {
    if (player.error) error = player.error;
  });

  // Typing a search goes back from an album's tracks to the results (but
  // not a search restored with the tracks by Back or Forward).
  let routedSearch = shownRoute.search;
  $effect(() => {
    if (search === routedSearch) return;
    routedSearch = search;
    tracksFor = null;
  });

  // Every change to where the main view is becomes a history entry, except
  // the keys typed in a search after the first one.
  const route: Route = $derived({ source, genre, artist, album: albumTitle, search, tracks: tracksFor });
  $effect(() => {
    const next = route;
    const hash = routeToHash(next);
    if (hash === routeToHash(shownRoute)) return;
    const url = location.pathname + location.search + hash;
    // Each entry remembers the one before it, for the tracks' Back button.
    if (replacesEntry(shownRoute, next)) history.replaceState(history.state, "", url);
    else history.pushState({ from: routeToHash(shownRoute) }, "", url);
    shownRoute = next;
  });

  // Back, Forward, or an address edited by hand.
  function followAddress() {
    const next = parseHash(location.hash);
    shownRoute = next;
    routedSearch = next.search;
    source = next.source;
    genre = next.genre;
    artist = next.artist;
    albumTitle = next.album;
    search = next.search;
    tracksFor = next.tracks;
    if (next.tracks === null && main?.contains(document.activeElement)) focusAlbums();
  }

  // Follow what's playing while signed in.
  $effect(() => {
    if (spotify.status === "signed-in") return player.start();
    player.playback = null;
  });

  $effect(() => {
    savePrefs({ view, sortKey, sortDir, browserHeight, linkedOnly, theme: theme.id });
  });

  $effect(() => {
    if (addOpen) addSheet.showModal();
    else if (addSheet.open) addSheet.close();
  });

  $effect(() => {
    if (infoIds.length > 0 && !infoWindow.open) infoWindow.showModal();
    else if (infoIds.length === 0 && infoWindow.open) infoWindow.close();
  });

  function selectSource(s: Source) {
    tracksFor = null;
    source = s;
    genre = artist = albumTitle = null;
  }

  function selectColumn(column: "genre" | "artist" | "album", key: string | null) {
    tracksFor = null;
    // Like iTunes, picking a genre resets the artist and album, and so on.
    if (column === "genre") {
      genre = key;
      artist = albumTitle = null;
    } else if (column === "artist") {
      artist = key;
      albumTitle = null;
    } else {
      albumTitle = key;
    }
  }

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDir = key === "rating" || key === "addedAt" ? "desc" : "asc";
    }
  }

  // --- Selection ---

  function select(ids: string[], at: string | null) {
    selection = ids;
    cursor = at;
  }

  /** Click: select one. ⌘/Ctrl-click: toggle. Shift-click: range from the anchor. */
  function pick(id: string, event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) {
    if (event.shiftKey && anchor) {
      select(rangeIds(anchor, id), id);
    } else if (event.metaKey || event.ctrlKey) {
      select(selectedSet.has(id) ? selection.filter((s) => s !== id) : [...selection, id], id);
      anchor = id;
    } else {
      select([id], id);
      anchor = id;
    }
  }

  function rangeIds(from: string, to: string): string[] {
    const ids = result.albums.map((a) => a.id);
    const [i, j] = [ids.indexOf(from), ids.indexOf(to)].sort((a, b) => a - b);
    return i === -1 ? [to] : ids.slice(i, j + 1);
  }

  function selectAll() {
    select(
      result.albums.map((a) => a.id),
      cursor,
    );
  }

  // --- Actions ---

  function openInSpotifyApp(album: Album) {
    if (album.spotify) window.location.href = album.spotify;
  }

  // The explicit Play action. Signed in to Spotify, it plays the album on
  // the active device; otherwise the link opens it in the Spotify app.
  function playAlbum(album: Album) {
    if (!album.spotify) return;
    if (spotify.status === "signed-in") player.play(album.spotify);
    else openInSpotifyApp(album);
  }

  // Double-click or Enter: the album's tracks when signed in (albums only),
  // otherwise Play.
  function openAlbum(album: Album) {
    if (spotify.status === "signed-in" && hasTrackList(album.spotify)) showTracks(album);
    else playAlbum(album);
  }

  // From the column browser's Albums column: editions share a title, so
  // open the first shown one that has a link.
  function openTitle(title: string) {
    const album = result.albums.find((a) => a.title === title && a.spotify);
    if (album) openAlbum(album);
  }

  async function run(action: () => Promise<unknown>) {
    error = null;
    try {
      await action();
    } catch (e) {
      error = (e as Error).message;
    }
  }

  function save() {
    if (library.canSaveToRepo) run(() => library.saveToRepo());
    else download();
  }

  function download() {
    run(async () => {
      const file = library.snapshot();
      downloadLibraryFile(file);
      await library.markExported(file);
    });
  }

  function importFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    if (confirm("Replace the whole local library with this file?")) {
      run(async () => library.importJson(await file.text()));
    }
    fileInput.value = "";
  }

  function remove(albums: Album[]) {
    if (albums.length === 0) return;
    const question =
      albums.length === 1
        ? `Remove “${albums[0].title}” from your library?`
        : `Remove these ${albums.length} albums from your library?`;
    if (!confirm(question)) return;
    const next = albumAfter(albums);
    run(async () => {
      for (const album of albums) await library.deleteAlbum(album.id);
      selectAfter(next);
      infoIds = [];
    });
  }

  /** Accept albums from triage: they join the library. */
  function accept(albums: Album[]) {
    if (albums.length === 0) return;
    const next = albumAfter(albums);
    run(async () => {
      await library.updateAlbums(
        albums.map((a) => a.id),
        (a) => ({ tags: a.tags.filter((t) => t !== TRIAGE_TAG) }),
      );
      selectAfter(next);
    });
  }

  /** The album shown after the last of these (else before them), to select once they leave the view. */
  function albumAfter(albums: Album[]): Album | null {
    const list = result.albums;
    const leaving = new Set(albums.map((a) => a.id));
    const last = Math.max(...albums.map((a) => list.indexOf(a)));
    return list.slice(last + 1).find((a) => !leaving.has(a.id)) ?? [...list].reverse().find((a) => !leaving.has(a.id)) ?? null;
  }

  // Like iTunes after a delete: the next album is selected.
  function selectAfter(next: Album | null) {
    select(next ? [next.id] : [], next?.id ?? null);
    anchor = next?.id ?? null;
  }

  function rate(album: Album, rating: number | null) {
    run(() => library.updateAlbum(album.id, { rating }));
  }

  function added(album: Album) {
    addOpen = false;
    // Show the new album: back to Music, filters cleared.
    selectSource({ kind: "music" });
    search = "";
    select([album.id], album.id);
    anchor = album.id;
  }

  function addedSeveral(albums: Album[]) {
    addOpen = false;
    selectSource({ kind: "music" });
    search = "";
    select(
      albums.map((a) => a.id),
      albums[0].id,
    );
    anchor = albums[0].id;
  }

  function getInfo() {
    if (selectedAlbums.length > 0) infoIds = selectedAlbums.map((a) => a.id);
  }

  /** Previous / Next in Get Info walk the main view, moving the selection along. */
  function navigateInfo(delta: 1 | -1) {
    const next = result.albums[infoIndex + delta];
    if (!next) return;
    infoIds = [next.id];
    select([next.id], next.id);
    anchor = next.id;
  }

  async function focusAlbums() {
    await tick();
    main.querySelector<HTMLElement>("[tabindex='0']")?.focus();
  }

  // --- Genres ---

  function renameGenre(id: string, name: string | null) {
    if (renamingGenre !== id) return;
    renamingGenre = null;
    const current = library.genres.find((g) => g.id === id);
    name = name?.trim() ?? "";
    if (!current || !name || name === current.name) return;
    const other = findGenreByName(library.genres, name);
    if (other && other.id !== id) {
      if (!confirm(`A genre named “${other.name}” already exists. Merge “${current.name}” into it?`)) return;
      run(async () => {
        await library.mergeGenre(id, other.id);
        if (genre === id) genre = other.id;
      });
    } else {
      run(() => library.renameGenre(id, name));
    }
  }

  function deleteGenre(id: string) {
    const name = genreNames.get(id) ?? id;
    const count = library.albums.filter((a) => a.genres.includes(id)).length;
    const detail = count === 0 ? "" : ` It will be removed from ${count} album${count === 1 ? "" : "s"}.`;
    if (confirm(`Delete the genre “${name}”?${detail}`)) run(() => library.deleteGenre(id));
  }

  // --- Menus and shortcuts ---

  function openMenu(event: MouseEvent, items: MenuItem[]) {
    event.preventDefault();
    menu = { x: event.clientX, y: event.clientY, items };
  }

  function themeMenu(button: HTMLElement) {
    const rect = button.getBoundingClientRect();
    // Above the button: the menu keeps itself inside the window.
    menu = {
      x: rect.left,
      y: rect.top,
      items: THEMES.map((t) => ({ label: t.name, checked: t.id === theme.id, action: () => (theme = t) })),
    };
  }

  async function devicesMenu(button: HTMLElement) {
    const devices = await player.loadDevices();
    if (!devices) return;
    const rect = button.getBoundingClientRect();
    const items: MenuItem[] = devices.length
      ? devices.map((d) => ({ label: d.name, checked: d.isActive, disabled: !d.usable, action: () => player.selectDevice(d.id) }))
      : [{ label: "No devices: open Spotify on one first", disabled: true, action: () => {} }];
    menu = { x: rect.left, y: rect.bottom + 2, items };
  }

  function albumMenu(event: MouseEvent, album: Album) {
    // Right-clicking outside the selection selects that album first.
    if (!selectedSet.has(album.id)) {
      select([album.id], album.id);
      anchor = album.id;
    }
    const many = selectedSet.size > 1;
    openMenu(event, [
      { label: many ? "Get Info (Multiple Items)" : "Get Info", action: getInfo },
      ...(spotify.status === "signed-in"
        ? [
            { label: "Play", action: () => playAlbum(album), disabled: many || !album.spotify },
            { label: "Show Tracks", action: () => showTracks(album), disabled: many || !hasTrackList(album.spotify) },
          ]
        : []),
      { label: "Open in Spotify", action: () => openInSpotifyApp(album), disabled: many || !album.spotify },
      "separator",
      ...(source.kind === "triage"
        ? [{ label: many ? `Accept ${selectedSet.size} Albums` : "Accept into Library", action: () => accept(selectedAlbums) }]
        : []),
      { label: many ? `Delete ${selectedSet.size} Albums` : "Delete from Library", action: () => remove(selectedAlbums) },
    ]);
  }

  function genreMenu(event: MouseEvent, id: string) {
    openMenu(event, [
      { label: "Rename Genre", action: () => (renamingGenre = id) },
      { label: "Delete Genre…", action: () => deleteGenre(id) },
    ]);
  }

  // Type-ahead: letters typed within a second of each other build one prefix.
  let typed = "";
  let typedAt = 0;

  function typeAheadKey(event: KeyboardEvent): boolean {
    if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return false;
    const now = event.timeStamp;
    if (now - typedAt > 1000) typed = "";
    if (typed === "" && event.key === " ") return false;
    typed += event.key;
    typedAt = now;
    const match = typeAhead(result.albums, typed, sortKey, genreNames);
    if (match) pick(match.id, { shiftKey: false, metaKey: false, ctrlKey: false });
    return true;
  }

  function showTracks(album: Album) {
    tracksFor = album.id;
    tick().then(() => main.querySelector<HTMLElement>(".tracks")?.focus());
  }

  // Back from the tracks: the browser's Back when it leads to the same list,
  // so the history doesn't fill up with list → tracks → list.
  function closeTracks() {
    if (history.state?.from === routeToHash({ ...route, tracks: null })) {
      history.back();
      return;
    }
    tracksFor = null;
    focusAlbums();
  }

  function onMainKeydown(event: KeyboardEvent) {
    // The track list handles its own keys.
    if (tracksAlbum) return;
    const list = result.albums;
    if (list.length === 0) return;
    if (typeAheadKey(event)) {
      event.preventDefault();
      return;
    }
    const i = cursor ? list.findIndex((a) => a.id === cursor) : -1;
    let step = 0;
    if (event.key === "ArrowDown") step = view === "grid" ? gridColumns() : 1;
    else if (event.key === "ArrowUp") step = view === "grid" ? -gridColumns() : -1;
    // ⌘← / ⌘→ are left to the player (see playerKey).
    else if (event.key === "ArrowRight" && view === "grid" && !event.metaKey && !event.ctrlKey) step = 1;
    else if (event.key === "ArrowLeft" && view === "grid" && !event.metaKey && !event.ctrlKey) step = -1;
    else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      if (source.kind === "triage") accept(selectedAlbums);
    } else if (event.key === "Enter" && selectedAlbums.length === 1) openAlbum(selectedAlbums[0]);
    else if (event.key === "Delete" || event.key === "Backspace") remove(selectedAlbums);
    else return;
    event.preventDefault();
    if (step !== 0) {
      const next = list[i === -1 ? 0 : Math.max(0, Math.min(list.length - 1, i + step))].id;
      // Shift extends the selection from the anchor.
      pick(next, { shiftKey: event.shiftKey, metaKey: false, ctrlKey: false });
    }
  }

  /** Space plays or pauses, ⌘← / ⌘→ go to the previous or next track, like iTunes. */
  function playerKey(event: KeyboardEvent): boolean {
    if (!player.active || event.defaultPrevented || event.altKey || event.shiftKey) return false;
    if (addOpen || infoIds.length > 0) return false;
    // Leave the keys to text fields, and Space to the open menu.
    const target = event.target as HTMLElement;
    if (target.closest?.("input, textarea, select, [contenteditable], [role=menu]")) return false;
    const command = event.metaKey || event.ctrlKey;
    if (event.key === " " && !command) player.togglePlay();
    else if (event.key === "ArrowLeft" && command) player.previous();
    else if (event.key === "ArrowRight" && command) player.next();
    else return false;
    return true;
  }

  function onWindowKeydown(event: KeyboardEvent) {
    if (playerKey(event)) {
      event.preventDefault();
      return;
    }
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    const modal = addOpen || infoIds.length > 0;
    if (key === "s") {
      event.preventDefault();
      if (library.unsavedChanges > 0) save();
    } else if (key === "i" && !modal) {
      event.preventDefault();
      getInfo();
    } else if (key === "a" && !modal && main.contains(document.activeElement)) {
      event.preventDefault();
      selectAll();
    }
  }

  function gridColumns(): number {
    const grid = main.querySelector(".grid");
    return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 1;
  }

  function loadPrefs(): Partial<{
    view: ViewMode;
    sortKey: SortKey;
    sortDir: SortDir;
    browserHeight: number;
    linkedOnly: boolean;
    theme: string;
  }> {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    } catch {
      return {};
    }
  }

  function savePrefs(value: object) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(value));
    } catch {
      // Storage unavailable: preferences just don't persist.
    }
  }
</script>

<svelte:window onkeydown={onWindowKeydown} onpopstate={followAddress} />
<svelte:head>
  <title>{library.unsavedChanges > 0 ? `FliTunes (${library.unsavedChanges} unsaved)` : "FliTunes"}</title>
</svelte:head>

<div class="window">
  <TopBar
    album={selectedAlbums.length === 1 ? selectedAlbums[0] : null}
    selectedCount={selectedAlbums.length}
    unsavedChanges={library.unsavedChanges}
    spotifyStatus={spotify.status}
    spotifyUser={spotify.user}
    playback={player.playback}
    ontoggleplay={() => player.togglePlay()}
    onnext={() => player.next()}
    onprevious={() => player.previous()}
    ondevices={devicesMenu}
    {playingAlbum}
    playingShown={playingAlbum !== null && playingAlbum.id === tracksAlbum?.id}
    onshowplaying={() => playingAlbum && showTracks(playingAlbum)}
    onspotify={() => (spotify.status === "signed-in" ? spotify.signOut() : spotify.signIn())}
    bind:view
    bind:linkedOnly
    bind:search
  />
  <input type="file" accept="application/json,.json" hidden bind:this={fileInput} onchange={importFile} />

  {#if library.status.kind === "conflict"}
    <div class="banner">
      library.json is newer than your local copy, but you have {library.unsavedChanges} unsaved changes.
      <button class="aqua" onclick={() => run(() => library.resolveConflict("file"))}>Load library.json</button>
      <button class="aqua" onclick={() => run(() => library.resolveConflict("local"))}>Keep Local Copy</button>
    </div>
  {/if}
  {#if library.status.kind === "error"}
    <div class="banner error">Failed to load the library: {library.status.message}</div>
  {/if}
  {#if error}
    <div class="banner error">
      {error}
      <button class="aqua" onclick={() => (error = null)}>OK</button>
    </div>
  {/if}

  <div class="body">
    <SourceList
      bind:source={() => source, selectSource}
      playlists={playlists(library.albums)}
      {triageCount}
      onadd={() => (addOpen = true)}
      unsavedChanges={library.unsavedChanges}
      canSaveToRepo={library.canSaveToRepo}
      onsave={save}
      ondownload={download}
      onimport={() => fileInput.click()}
      {theme}
      ontheme={themeMenu}
    />

    <div class="content">
      {#if source.kind === "triage" && !tracksAlbum}
        <div class="triage-bar">
          <span>
            Imported albums waiting for review. Accept keeps them in your library, Delete removes them.
          </span>
          <button class="aqua" disabled={selectedAlbums.length === 0} onclick={() => accept(selectedAlbums)} title="⌘↩"
            >Accept</button
          >
          <button class="aqua" disabled={selectedAlbums.length === 0} onclick={() => remove(selectedAlbums)} title="Delete"
            >Delete</button
          >
        </div>
      {/if}
      <ColumnBrowser
        genres={result.genres}
        artists={result.artists}
        albumTitles={result.albumTitles}
        genre={result.genre}
        artist={result.artist}
        album={result.album}
        onselect={selectColumn}
        onopenalbum={openTitle}
        {renamingGenre}
        ongenremenu={genreMenu}
        onrenamestart={(id) => (renamingGenre = id)}
        onrenamegenre={renameGenre}
        bind:height={browserHeight}
      />
      <!-- Keyboard events bubble up from the list or grid. -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="main" role="region" aria-label="Albums" bind:this={main} onkeydown={onMainKeydown}>
        {#if library.status.kind === "loading"}
          <p class="empty">Loading…</p>
        {:else if library.albums.length === 0}
          <p class="empty">Your library is empty. Click <strong>+</strong> to add an album.</p>
        {:else if tracksAlbum?.spotify}
          {@const uri = tracksAlbum.spotify}
          <AlbumTracks
            album={tracksAlbum}
            genre={genreName(tracksAlbum, genreNames)}
            load={() => albumTracks(spotify, uri)}
            loadYear={() => albumYear(spotify, uri)}
            playingUri={player.playback?.track?.uri ?? null}
            isPlaying={player.playback?.isPlaying ?? false}
            onplay={(trackUri) => player.play(uri, trackUri)}
            onback={closeTracks}
          />
        {:else if result.albums.length === 0}
          <p class="empty">{source.kind === "triage" && result.total === 0 ? "Nothing left to review." : "No albums match."}</p>
        {:else if view !== "grid"}
          <AlbumList
            albums={result.albums}
            covers={view === "albums"}
            {genreNames}
            selected={selectedSet}
            {cursor}
            {sortKey}
            {sortDir}
            onsort={sortBy}
            onpick={pick}
            onopen={openAlbum}
            onplay={playAlbum}
            signedIn={spotify.status === "signed-in"}
            onrate={rate}
            onmenu={albumMenu}
          />
        {:else}
          <AlbumGrid
            albums={result.albums}
            selected={selectedSet}
            {cursor}
            onpick={pick}
            onopen={openAlbum}
            onplay={playAlbum}
            signedIn={spotify.status === "signed-in"}
            onmenu={albumMenu}
          />
        {/if}
      </div>
    </div>
  </div>

  <footer class="status">
    <div class="buttons">
      <!-- Narrow windows hide the source list and its buttons: they show here instead. -->
      <button class="square narrow" title="Add Album(s)…" aria-label="Add Album(s)" onclick={() => (addOpen = true)}
        >+</button
      >
    </div>
    <div class="count">
      {result.albums.length}
      {result.albums.length === 1 ? "album" : "albums"}
      {#if selectedAlbums.length > 1}· {selectedAlbums.length} selected{/if}
      {#if linkedOnly}· albums without a Spotify link hidden{/if}
    </div>
    <div class="buttons end">
      {#if library.canSaveToRepo}
        <button class="aqua narrow" disabled={library.unsavedChanges === 0} onclick={save}>Save</button>
      {/if}
      <button class="aqua narrow" onclick={download}>Export</button>
      <button class="aqua narrow" onclick={() => fileInput.click()}>Import</button>
    </div>
  </footer>
</div>

<dialog
  class="sheet"
  class:wide={addMode.kind !== "one"}
  bind:this={addSheet}
  oncancel={() => (addOpen = false)}
  onclose={() => {
    addMode = { kind: "one" };
    focusAlbums();
  }}
>
  {#if !addOpen}
    <!-- Nothing: the form is re-created each time the sheet opens. -->
  {:else if addMode.kind === "several"}
    <AddSeveral
      {library}
      text={addMode.text}
      onadded={addedSeveral}
      oncancel={() => (addOpen = false)}
      onsingle={() => (addMode = { kind: "one" })}
    />
  {:else if addMode.kind === "csv"}
    <ImportCsv {library} onadded={addedSeveral} oncancel={() => (addOpen = false)} />
  {:else}
    <AddAlbum
      {library}
      onadded={added}
      oncancel={() => (addOpen = false)}
      onseveral={(text) => (addMode = { kind: "several", text })}
      oncsv={() => (addMode = { kind: "csv" })}
    />
  {/if}
</dialog>

<dialog class="info-window" bind:this={infoWindow} oncancel={() => (infoIds = [])} onclose={focusAlbums}>
  {#if infoAlbums.length > 0}
    <GetInfo
      {library}
      albums={infoAlbums}
      canPrevious={infoIndex > 0}
      canNext={infoIndex !== -1 && infoIndex < result.albums.length - 1}
      onnavigate={navigateInfo}
      ondelete={() => remove(infoAlbums)}
      onclose={() => (infoIds = [])}
    />
  {/if}
</dialog>

{#if menu}
  <ContextMenu {...menu} onclose={() => (menu = null)} />
{/if}

<style>
  .window {
    display: grid;
    grid-template-rows: auto auto auto auto 1fr auto;
    height: 100%;
  }
  .body {
    display: grid;
    grid-template-columns: 190px minmax(0, 1fr);
    min-height: 0;
    grid-row: 5;
  }
  /* The column browser shrinks before the album list gets too small. */
  .content {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .main {
    flex: 1 1 0;
    min-height: 100px;
    outline: none;
  }
  .empty {
    margin: 40px auto;
    text-align: center;
    color: var(--text-dim);
    font-size: 13px;
  }
  .triage-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: oklch(91.8% calc(0.027 * var(--tint)) var(--hue));
    border-bottom: 1px solid oklch(76.4% calc(0.038 * var(--tint)) var(--hue));
    color: oklch(35.5% calc(0.037 * var(--tint)) var(--hue));
  }
  .triage-bar span {
    flex: 1;
    min-width: 0;
  }
  .banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: #fff4c4;
    border-bottom: 1px solid #d8c26a;
  }
  .banner.error {
    background: #fde2e2;
    border-color: #d99;
  }
  .status {
    grid-row: 6;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 3px 8px;
    padding-bottom: calc(3px + env(safe-area-inset-bottom, 0px));
    background: var(--toolbar);
    border-top: 1px solid var(--toolbar-border);
  }
  .count {
    color: #333;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
  }
  .square {
    width: 24px;
    height: 20px;
    padding: 0;
    border: 1px solid oklch(59.6% calc(0.034 * var(--tint)) var(--hue));
    border-radius: 3px;
    background: linear-gradient(oklch(99.1% calc(0.004 * var(--tint)) var(--hue)), oklch(87.3% calc(0.025 * var(--tint)) var(--hue)));
    font-size: 15px;
    line-height: 1;
    color: #333;
  }
  .square:active {
    background: linear-gradient(#bdbdbd, oklch(92.6% calc(0.018 * var(--tint)) var(--hue)));
  }
  .narrow {
    display: none;
  }
  .buttons.end {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
  }
  /* Sheets slide down from the toolbar. */
  .sheet {
    margin: 0 auto;
    top: 0;
    width: min(620px, calc(100% - 32px));
    max-height: 90vh;
    padding: 0;
    border: 1px solid oklch(64.0% calc(0.031 * var(--tint)) var(--hue));
    border-top: none;
    border-radius: 0 0 6px 6px;
    background: oklch(95.0% calc(0.013 * var(--tint)) var(--hue));
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  }
  .sheet.wide {
    width: min(760px, calc(100% - 32px));
  }
  .sheet[open] {
    animation: slide 0.2s ease-out;
  }
  .sheet::backdrop,
  .info-window::backdrop {
    background: rgba(0, 0, 0, 0.15);
  }
  @keyframes slide {
    from {
      transform: translateY(-100%);
    }
  }
  /* Get Info is its own window, like in iTunes. */
  .info-window {
    width: min(560px, calc(100% - 32px));
    max-height: calc(100vh - 32px);
    padding: 0;
    border: 1px solid #6e6e6e;
    border-radius: 5px;
    background: oklch(95.0% calc(0.013 * var(--tint)) var(--hue));
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    overflow: auto;
  }
  @media (max-width: 700px) {
    .body {
      grid-template-columns: 1fr;
    }
    .body :global(.sources) {
      display: none;
    }
    .narrow {
      display: block;
    }
  }
</style>
