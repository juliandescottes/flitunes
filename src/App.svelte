<script lang="ts">
  // The iTunes 10 window: toolbar, source list, column browser, list or grid
  // view, and status bar.
  import { tick } from "svelte";
  import AddAlbum from "./components/AddAlbum.svelte";
  import AlbumGrid from "./components/AlbumGrid.svelte";
  import AlbumList from "./components/AlbumList.svelte";
  import ColumnBrowser from "./components/ColumnBrowser.svelte";
  import SourceList from "./components/SourceList.svelte";
  import TopBar from "./components/TopBar.svelte";
  import { browse, playlists, type SortDir, type SortKey, type Source, type ViewMode } from "./lib/browse.ts";
  import { LibraryDB } from "./lib/db.ts";
  import { Library } from "./lib/library.svelte.ts";
  import type { Album } from "./lib/model.ts";
  import { downloadLibraryFile, repoSource } from "./lib/persistence.ts";

  const library = new Library(new LibraryDB(), repoSource);
  library.load();

  // View preferences survive reloads (per browser only).
  const PREFS_KEY = "album-library:view";
  const prefs = loadPrefs();

  let source = $state<Source>({ kind: "music" });
  let search = $state("");
  let genre = $state<string | null>(null);
  let artist = $state<string | null>(null);
  let albumTitle = $state<string | null>(null);
  let sortKey = $state<SortKey>(prefs.sortKey ?? "artist");
  let sortDir = $state<SortDir>(prefs.sortDir ?? "asc");
  let view = $state<ViewMode>(prefs.view ?? "list");
  let selectedId = $state<string | null>(null);
  let addOpen = $state(false);
  let error = $state<string | null>(null);

  let fileInput: HTMLInputElement;
  let sheet: HTMLDialogElement;
  let main: HTMLDivElement;

  const genreNames = $derived(new Map(library.genres.map((g) => [g.id, g.name])));
  const result = $derived(
    browse(library.albums, library.genres, { source, search, genre, artist, album: albumTitle, sortKey, sortDir }),
  );
  const selected = $derived(result.albums.find((a) => a.id === selectedId) ?? null);

  $effect(() => {
    savePrefs({ view, sortKey, sortDir });
  });

  $effect(() => {
    if (addOpen) sheet.showModal();
    else if (sheet.open) sheet.close();
  });

  function selectSource(s: Source) {
    source = s;
    genre = artist = albumTitle = null;
  }

  function selectColumn(column: "genre" | "artist" | "album", key: string | null) {
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

  function openInSpotify(album: Album) {
    if (album.spotify) window.location.href = album.spotify;
  }

  async function run(action: () => Promise<unknown>) {
    error = null;
    try {
      await action();
    } catch (e) {
      error = (e as Error).message;
    }
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

  function remove(album: Album) {
    if (!confirm(`Remove “${album.title}” from your library?`)) return;
    const list = result.albums;
    const i = list.indexOf(album);
    run(async () => {
      await library.deleteAlbum(album.id);
      selectedId = (list[i + 1] ?? list[i - 1])?.id ?? null;
    });
  }

  function added(album: Album) {
    addOpen = false;
    // Show the new album: back to Music, filters cleared.
    selectSource({ kind: "music" });
    search = "";
    selectedId = album.id;
  }

  async function focusAlbums() {
    await tick();
    main.querySelector<HTMLElement>("[tabindex='0']")?.focus();
  }

  function onMainKeydown(event: KeyboardEvent) {
    const list = result.albums;
    if (list.length === 0) return;
    const i = selected ? list.indexOf(selected) : -1;
    let step = 0;
    if (event.key === "ArrowDown") step = view === "grid" ? gridColumns() : 1;
    else if (event.key === "ArrowUp") step = view === "grid" ? -gridColumns() : -1;
    else if (event.key === "ArrowRight" && view === "grid") step = 1;
    else if (event.key === "ArrowLeft" && view === "grid") step = -1;
    else if (event.key === "Enter" && selected) openInSpotify(selected);
    else if ((event.key === "Delete" || event.key === "Backspace") && selected) remove(selected);
    else return;
    event.preventDefault();
    if (step !== 0) {
      const next = i === -1 ? 0 : Math.max(0, Math.min(list.length - 1, i + step));
      selectedId = list[next].id;
    }
  }

  function gridColumns(): number {
    const grid = main.querySelector(".grid");
    return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 1;
  }

  function loadPrefs(): Partial<{ view: ViewMode; sortKey: SortKey; sortDir: SortDir }> {
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

<div class="window">
  <TopBar
    album={selected}
    unsavedChanges={library.unsavedChanges}
    canSaveToRepo={library.canSaveToRepo}
    bind:view
    bind:search
    onsave={() => run(() => library.saveToRepo())}
    ondownload={download}
    onimport={() => fileInput.click()}
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
    <SourceList bind:source={() => source, selectSource} playlists={playlists(library.albums)} />

    <div class="content">
      <ColumnBrowser
        genres={result.genres}
        artists={result.artists}
        albumTitles={result.albumTitles}
        genre={result.genre}
        artist={result.artist}
        album={result.album}
        onselect={selectColumn}
      />
      <!-- Keyboard events bubble up from the list or grid. -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="main" role="region" aria-label="Albums" bind:this={main} onkeydown={onMainKeydown}>
        {#if library.status.kind === "loading"}
          <p class="empty">Loading…</p>
        {:else if library.albums.length === 0}
          <p class="empty">Your library is empty. Click <strong>+</strong> to add an album.</p>
        {:else if result.albums.length === 0}
          <p class="empty">No albums match.</p>
        {:else if view === "list"}
          <AlbumList
            albums={result.albums}
            {genreNames}
            bind:selectedId
            {sortKey}
            {sortDir}
            onsort={sortBy}
            onopen={openInSpotify}
          />
        {:else}
          <AlbumGrid albums={result.albums} bind:selectedId onopen={openInSpotify} />
        {/if}
      </div>
    </div>
  </div>

  <footer class="status">
    <div class="buttons">
      <button class="square" title="Add to Library…" aria-label="Add to Library" onclick={() => (addOpen = true)}>+</button>
    </div>
    <div class="count">
      {result.albums.length}
      {result.albums.length === 1 ? "album" : "albums"}
    </div>
    <div class="buttons"></div>
  </footer>
</div>

<dialog class="sheet" bind:this={sheet} oncancel={() => (addOpen = false)} onclose={focusAlbums}>
  {#if addOpen}
    <AddAlbum {library} onadded={added} oncancel={() => (addOpen = false)} />
  {/if}
</dialog>

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
  .content {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
  }
  .main {
    min-height: 0;
    outline: none;
  }
  .empty {
    margin: 40px auto;
    text-align: center;
    color: var(--text-dim);
    font-size: 13px;
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
    border: 1px solid #7d7d7d;
    border-radius: 3px;
    background: linear-gradient(#fdfdfd, #d4d4d4);
    font-size: 15px;
    line-height: 1;
    color: #333;
  }
  .square:active {
    background: linear-gradient(#bdbdbd, #e2e2e2);
  }
  /* Sheets slide down from the toolbar. */
  .sheet {
    margin: 0 auto;
    top: 0;
    width: min(620px, calc(100% - 32px));
    max-height: 90vh;
    padding: 0;
    border: 1px solid #8a8a8a;
    border-top: none;
    border-radius: 0 0 6px 6px;
    background: #ececec;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  }
  .sheet[open] {
    animation: slide 0.2s ease-out;
  }
  .sheet::backdrop {
    background: rgba(0, 0, 0, 0.15);
  }
  @keyframes slide {
    from {
      transform: translateY(-100%);
    }
  }
  @media (max-width: 700px) {
    .body {
      grid-template-columns: 1fr;
    }
    .body :global(.sources) {
      display: none;
    }
  }
</style>
