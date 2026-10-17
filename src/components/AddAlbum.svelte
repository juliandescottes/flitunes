<script lang="ts">
  // Add-album form: paste a Spotify link to prefill the title and cover
  // (oEmbed). Everything else is entered by hand.
  import { untrack } from "svelte";
  import type { Library } from "../lib/library.svelte.ts";
  import { findGenreByName, VARIOUS_ARTISTS, type Album } from "../lib/model.ts";
  import { fetchSpotifyAlbumInfo, parseSpotifyAlbumId, spotifyUri } from "../lib/spotify.ts";

  let {
    library,
    onadded,
    oncancel,
  }: { library: Library; onadded: (album: Album) => void; oncancel: () => void } = $props();

  let link = $state("");
  let title = $state("");
  let artists = $state("");
  let year = $state("");
  let genres = $state<string[]>([]);
  let cover = $state("");
  let newGenre = $state("");

  let busy = $state(false);
  let error = $state<string | null>(null);
  // The last looked-up album id, and a counter to ignore stale responses.
  let lookedUp: string | null = null;
  let request = 0;

  const albumId = $derived(parseSpotifyAlbumId(link));
  const linkInvalid = $derived(link.trim() !== "" && albumId === null);
  const duplicates = $derived(albumId ? library.findBySpotify(spotifyUri(albumId)) : []);
  const genreName = (id: string) => library.genres.find((g) => g.id === id)?.name ?? id;

  // Look up a newly pasted link once.
  $effect(() => {
    const id = albumId;
    if (id && id !== lookedUp) untrack(() => lookupSpotify(id));
  });

  async function lookupSpotify(id: string) {
    lookedUp = id;
    const req = ++request;
    busy = true;
    error = null;
    try {
      const info = await fetchSpotifyAlbumInfo(id);
      if (req !== request) return;
      title = info.title;
      cover = info.cover ?? "";
    } catch (e) {
      if (req === request) error = `${(e as Error).message}. You can still fill in the fields by hand.`;
    } finally {
      if (req === request) busy = false;
    }
  }

  async function addGenre(name: string) {
    name = name.trim();
    if (!name) return;
    error = null;
    try {
      const genre = findGenreByName(library.genres, name) ?? (await library.addGenre(name));
      if (!genres.includes(genre.id)) genres = [...genres, genre.id];
      newGenre = "";
    } catch (e) {
      error = (e as Error).message;
    }
  }

  function makePrimary(id: string) {
    genres = [id, ...genres.filter((g) => g !== id)];
  }

  function reset() {
    link = title = artists = year = cover = newGenre = "";
    genres = [];
    error = null;
    lookedUp = null;
    request++;
    busy = false;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    const parsedYear = year.trim() ? Number(year) : null;
    if (parsedYear !== null && !Number.isInteger(parsedYear)) {
      error = "Year must be a number";
      return;
    }
    try {
      const album = await library.addAlbum({
        title,
        artists: artists.split(";"),
        year: parsedYear,
        genres,
        spotify: albumId ? spotifyUri(albumId) : null,
        cover: cover.trim() || null,
      });
      reset();
      onadded(album);
    } catch (e) {
      error = (e as Error).message;
    }
  }

  function cancel() {
    reset();
    oncancel();
  }
</script>

<form class="add" onsubmit={submit}>
  <h2>Add to Library</h2>

  <label class="wide">
    Spotify link
    <input
      placeholder="https://open.spotify.com/album/… (optional)"
      bind:value={link}
      aria-invalid={linkInvalid}
    />
  </label>
  {#if linkInvalid}<p class="hint error">Not a Spotify album link.</p>{/if}
  {#if busy}<p class="hint">Looking up…</p>{/if}
  {#if duplicates.length > 0}
    <p class="hint warning">
      Already in the library: {duplicates.map((a) => `${a.artists.join(", ")} — ${a.title}`).join("; ")}
    </p>
  {/if}

  <div class="body">
    <div class="cover">
      {#if cover.trim()}
        <img src={cover} alt="" />
      {:else}
        <div class="placeholder">No cover</div>
      {/if}
    </div>

    <div class="fields">
      <label>
        Title
        <input bind:value={title} required />
      </label>
      <label>
        Artist <span class="sub">(separate several with ";")</span>
        <span class="row">
          <input bind:value={artists} required />
          <button type="button" class="link" onclick={() => (artists = VARIOUS_ARTISTS)}>Compilation</button>
        </span>
      </label>
      <label>
        Year
        <input bind:value={year} inputmode="numeric" size="6" />
      </label>

      <div class="genres">
        Genres <span class="sub">(the first one is primary)</span>
        <div class="row">
          {#each genres as id, i (id)}
            <span class="chip" class:primary={i === 0}>
              {#if i > 0}
                <button type="button" class="link" title="Make primary" onclick={() => makePrimary(id)}>{genreName(id)}</button>
              {:else}
                {genreName(id)}
              {/if}
              <button type="button" class="link" aria-label="Remove" onclick={() => (genres = genres.filter((g) => g !== id))}>×</button>
            </span>
          {/each}
          <input
            list="genre-names"
            placeholder="Add genre"
            size="12"
            bind:value={newGenre}
            onkeydown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addGenre(newGenre);
              }
            }}
          />
          <datalist id="genre-names">
            {#each library.genres as g (g.id)}<option value={g.name}></option>{/each}
          </datalist>
          {#if newGenre.trim()}
            <button type="button" onclick={() => addGenre(newGenre)}>
              {findGenreByName(library.genres, newGenre) ? "Add" : `Create “${newGenre.trim()}”`}
            </button>
          {/if}
        </div>
      </div>

      <label>
        Cover URL
        <input bind:value={cover} type="url" />
      </label>
    </div>
  </div>

  {#if error}<p class="hint error">{error}</p>{/if}

  <div class="row actions">
    <button type="button" class="aqua" onclick={cancel}>Cancel</button>
    <button class="aqua default">{duplicates.length > 0 ? "Add Anyway" : "Add"}</button>
  </div>
</form>

<style>
  .add {
    padding: 14px 18px;
  }
  h2 {
    margin: 0 0 10px;
    font-size: 13px;
  }
  input {
    font: inherit;
  }
  label,
  .genres {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 8px;
  }
  .wide input {
    width: 100%;
    box-sizing: border-box;
  }
  .body {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
  .fields {
    flex: 1;
    min-width: 240px;
  }
  .cover img,
  .placeholder {
    width: 140px;
    height: 140px;
    object-fit: cover;
    border-radius: 4px;
  }
  .placeholder {
    background: #eee;
    color: #999;
    display: grid;
    place-items: center;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .row input {
    flex: 1;
  }
  .chip {
    background: #eef;
    border-radius: 12px;
    padding: 2px 8px;
  }
  .chip.primary {
    background: #ccf;
    font-weight: 600;
  }
  .sub {
    color: #666;
    font-size: 0.85em;
  }
  .hint {
    margin: 4px 0;
    font-size: 0.9em;
  }
  .error {
    color: #c00;
  }
  .warning {
    color: #a60;
  }
  .actions {
    margin-top: 12px;
    justify-content: flex-end;
  }
  .link {
    border: none;
    background: none;
    color: #06c;
    cursor: pointer;
    padding: 0;
  }
  [aria-invalid="true"] {
    border-color: #c00;
  }
</style>
