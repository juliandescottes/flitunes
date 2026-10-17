<script lang="ts">
  // Temporary shell to exercise the store and persistence. The real browse UI
  // (column browser, cover grid, album detail) comes next.
  import { LibraryDB } from "./lib/db.ts";
  import { Library } from "./lib/library.svelte.ts";
  import { artistSortKey } from "./lib/model.ts";
  import { downloadLibraryFile, repoSource } from "./lib/persistence.ts";

  const library = new Library(new LibraryDB(), repoSource);
  library.load();

  let title = $state("");
  let artist = $state("");
  let year = $state("");
  let error = $state<string | null>(null);
  let fileInput: HTMLInputElement;

  const sorted = $derived(
    [...library.albums].sort(
      (a, b) => artistSortKey(a).localeCompare(artistSortKey(b)) || (a.year ?? 0) - (b.year ?? 0),
    ),
  );

  async function run(action: () => Promise<unknown>) {
    error = null;
    try {
      await action();
    } catch (e) {
      error = (e as Error).message;
    }
  }

  function add(event: SubmitEvent) {
    event.preventDefault();
    run(async () => {
      await library.addAlbum({ title, artists: [artist], year: year ? Number(year) : null });
      title = artist = year = "";
    });
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
    if (!confirm("Replace the whole local library with this file?")) return;
    run(async () => library.importJson(await file.text()));
    fileInput.value = "";
  }
</script>

<header>
  <h1>Album Library</h1>
  <span class="count">{library.albums.length} albums</span>
  {#if library.unsavedChanges > 0}
    <span class="badge">{library.unsavedChanges} unsaved</span>
  {/if}
  <span class="spacer"></span>
  {#if library.canSaveToRepo}
    <button onclick={() => run(() => library.saveToRepo())}>Save to repo</button>
  {/if}
  <button onclick={download}>Download JSON</button>
  <button onclick={() => fileInput.click()}>Import JSON…</button>
  <input type="file" accept="application/json,.json" hidden bind:this={fileInput} onchange={importFile} />
</header>

{#if library.status.kind === "loading"}
  <p>Loading…</p>
{:else if library.status.kind === "error"}
  <p class="error">Failed to load library: {library.status.message}</p>
{:else}
  {#if library.status.kind === "conflict"}
    <div class="banner">
      library.json is newer than your local copy, but you have {library.unsavedChanges} unsaved changes.
      <button onclick={() => run(() => library.resolveConflict("file"))}>Load library.json (discard local)</button>
      <button onclick={() => run(() => library.resolveConflict("local"))}>Keep local</button>
    </div>
  {/if}

  {#if error}<p class="error">{error}</p>{/if}

  <form onsubmit={add}>
    <input placeholder="Title" bind:value={title} required />
    <input placeholder="Artist" bind:value={artist} required />
    <input placeholder="Year" bind:value={year} inputmode="numeric" size="6" />
    <button>Add</button>
  </form>

  <ul>
    {#each sorted as album (album.id)}
      <li>
        <strong>{album.artists.join(", ")}</strong> — {album.title}
        {#if album.year}({album.year}){/if}
        <button class="link" onclick={() => run(() => library.deleteAlbum(album.id))}>delete</button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  :global(body) {
    font-family: system-ui, sans-serif;
    margin: 0 16px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .spacer {
    flex: 1;
  }
  .count {
    color: #666;
  }
  .badge {
    background: #f5a623;
    color: #000;
    border-radius: 8px;
    padding: 0 8px;
    font-size: 0.85em;
  }
  .banner {
    background: #fff4d6;
    padding: 8px;
    border-radius: 4px;
  }
  .error {
    color: #c00;
  }
  form {
    display: flex;
    gap: 8px;
    margin: 16px 0;
  }
  .link {
    border: none;
    background: none;
    color: #06c;
    cursor: pointer;
  }
</style>
