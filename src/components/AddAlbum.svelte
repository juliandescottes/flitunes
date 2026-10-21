<script lang="ts">
  // Add-album form: paste a Spotify link to prefill the title and cover
  // (oEmbed). Everything else is entered by hand.
  import { untrack } from "svelte";
  import type { Library } from "../lib/library.svelte.ts";
  import { VARIOUS_ARTISTS, type Album } from "../lib/model.ts";
  import { fetchSpotifyInfo, parseSpotifyLink, parseSpotifyLinks } from "../lib/spotify.ts";
  import ChipInput from "./ChipInput.svelte";
  import { genreChips, parseYear, playlistChips, splitArtists } from "./fields.ts";

  let {
    library,
    onadded,
    oncancel,
    onseveral,
    oncsv,
  }: {
    library: Library;
    onadded: (album: Album) => void;
    oncancel: () => void;
    /** Switches to Add Several, with the links pasted so far. */
    onseveral: (text: string) => void;
    oncsv: () => void;
  } = $props();

  let link = $state("");
  let title = $state("");
  let artists = $state("");
  let year = $state("");
  let genres = $state<string[]>([]);
  let tags = $state<string[]>([]);
  let cover = $state("");

  let busy = $state(false);
  let error = $state<string | null>(null);
  // The last looked-up Spotify URI, and a counter to ignore stale responses.
  let lookedUp: string | null = null;
  let request = 0;

  const spotify = $derived(parseSpotifyLink(link));
  const linkInvalid = $derived(link.trim() !== "" && spotify === null);
  const duplicates = $derived(spotify ? library.findBySpotify(spotify) : []);

  // Pasting several links switches to Add Several. Read the clipboard
  // directly: a one-line input would drop the line breaks between them.
  function onpaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (parseSpotifyLinks(text).uris.length > 1) {
      event.preventDefault();
      onseveral(text);
    }
  }

  // Look up a newly pasted link once.
  $effect(() => {
    const uri = spotify;
    if (uri && uri !== lookedUp) untrack(() => lookupSpotify(uri));
  });

  async function lookupSpotify(uri: string) {
    lookedUp = uri;
    const req = ++request;
    busy = true;
    error = null;
    try {
      const info = await fetchSpotifyInfo(uri);
      if (req !== request) return;
      title = info.title;
      cover = info.cover ?? "";
    } catch (e) {
      if (req === request) error = `${(e as Error).message}. You can still fill in the fields by hand.`;
    } finally {
      if (req === request) busy = false;
    }
  }

  function reset() {
    link = title = artists = year = cover = "";
    genres = [];
    tags = [];
    error = null;
    lookedUp = null;
    request++;
    busy = false;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    try {
      const album = await library.addAlbum({
        title,
        artists: splitArtists(artists),
        year: parseYear(year),
        genres,
        tags,
        spotify,
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
  <div class="head">
    <h2>Add to Library</h2>
    <span class="links">
      <button type="button" class="link" onclick={() => onseveral(link)}>Add Several…</button>
      <button type="button" class="link" onclick={oncsv}>Import CSV…</button>
    </span>
  </div>

  <label class="wide">
    Spotify link
    <input
      placeholder="https://open.spotify.com/album/… (optional)"
      bind:value={link}
      aria-invalid={linkInvalid}
      {onpaste}
    />
  </label>
  {#if linkInvalid}<p class="hint error">Not a Spotify album or playlist link.</p>{/if}
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

      <div class="field">
        Genres <span class="sub">(the first one is primary)</span>
        <ChipInput bind:values={genres} primary {...genreChips(library)} />
      </div>
      <div class="field">
        Playlists
        <ChipInput bind:values={tags} {...playlistChips(library)} />
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
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 10px;
  }
  .links {
    display: flex;
    gap: 12px;
  }
  h2 {
    margin: 0;
    font-size: 13px;
  }
  input {
    font: inherit;
  }
  label,
  .field {
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
    color: oklch(57.2% calc(0.174 * var(--tint)) var(--hue));
    cursor: pointer;
    padding: 0;
  }
  [aria-invalid="true"] {
    border-color: #c00;
  }
</style>
