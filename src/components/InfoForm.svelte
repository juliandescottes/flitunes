<script lang="ts">
  // Get Info for one album: Info and Artwork tabs, Previous / Next like iTunes.
  // Edits are kept in a draft and written on OK, Previous or Next.
  import { untrack } from "svelte";
  import type { Library } from "../lib/library.svelte.ts";
  import type { Album } from "../lib/model.ts";
  import { fetchSpotifyInfo, parseSpotifyLink, spotifyWebUrl } from "../lib/spotify.ts";
  import ChipInput from "./ChipInput.svelte";
  import { genreChips, joinArtists, parseYear, playlistChips, splitArtists } from "./fields.ts";
  import StarRating from "./StarRating.svelte";

  let {
    library,
    album,
    tab = $bindable(),
    canPrevious,
    canNext,
    onnavigate,
    ondelete,
    onclose,
  }: {
    library: Library;
    album: Album;
    tab: "info" | "artwork";
    canPrevious: boolean;
    canNext: boolean;
    onnavigate: (delta: 1 | -1) => void;
    ondelete: () => void;
    onclose: () => void;
  } = $props();

  // The form is re-created for each album (see GetInfo), so the draft
  // only needs the initial values.
  const initial = untrack(() => album);
  let title = $state(initial.title);
  let artists = $state(joinArtists(initial.artists));
  let artistSort = $state(initial.artistSort ?? "");
  let year = $state(initial.year?.toString() ?? "");
  let genres = $state([...initial.genres]);
  let rating = $state(initial.rating);
  let tags = $state([...initial.tags]);
  let notes = $state(initial.notes);
  const initialUri = initial.spotify ? parseSpotifyLink(initial.spotify) : null;
  let link = $state(initialUri ? spotifyWebUrl(initialUri) : "");
  let cover = $state(initial.cover ?? "");
  let error = $state<string | null>(null);
  let fetchingCover = $state(false);

  const spotify = $derived(parseSpotifyLink(link));
  const linkInvalid = $derived(link.trim() !== "" && spotify === null);

  async function save(): Promise<boolean> {
    error = null;
    if (linkInvalid) {
      error = "The Spotify link is not an album or playlist link.";
      return false;
    }
    try {
      await library.updateAlbum(initial.id, {
        title,
        artists: splitArtists(artists),
        artistSort,
        year: parseYear(year),
        genres,
        rating,
        tags,
        notes,
        spotify,
        cover: cover.trim() || null,
      });
      return true;
    } catch (e) {
      error = (e as Error).message;
      return false;
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (await save()) onclose();
  }

  async function navigate(delta: 1 | -1) {
    if (await save()) onnavigate(delta);
  }

  async function useSpotifyCover() {
    if (!spotify) return;
    fetchingCover = true;
    error = null;
    try {
      const info = await fetchSpotifyInfo(spotify);
      if (info.cover) cover = info.cover;
      else error = "Spotify has no cover for this album.";
    } catch (e) {
      error = (e as Error).message;
    } finally {
      fetchingCover = false;
    }
  }
</script>

<form onsubmit={submit}>
  <div class="summary">
    {#if cover.trim()}<img src={cover} alt="" />{:else}<div class="blank">♫</div>{/if}
    <div>
      <div class="big">{title || "Untitled"}</div>
      <div>{artists}</div>
      <div class="dim">{year}</div>
    </div>
  </div>

  <div class="tabs" role="tablist">
    <button type="button" role="tab" aria-selected={tab === "info"} class:on={tab === "info"} onclick={() => (tab = "info")}>Info</button>
    <button type="button" role="tab" aria-selected={tab === "artwork"} class:on={tab === "artwork"} onclick={() => (tab = "artwork")}>Artwork</button>
  </div>

  <div class="panel">
    {#if tab === "info"}
      <div class="grid">
        <label for="info-title">Name</label>
        <input id="info-title" bind:value={title} required />

        <label for="info-artist">Artist</label>
        <input id="info-artist" bind:value={artists} required title='Separate several artists with ";"' />

        <label for="info-sort">Sort Artist</label>
        <input id="info-sort" bind:value={artistSort} placeholder={'e.g. "Beatles, The"'} />

        <label for="info-year">Year</label>
        <input id="info-year" class="short" bind:value={year} inputmode="numeric" />

        <span class="label">Genres</span>
        <ChipInput bind:values={genres} primary {...genreChips(library)} />

        <span class="label">Rating</span>
        <span class="rating show-dots"><StarRating value={rating} onchange={(r) => (rating = r)} /></span>

        <span class="label">Playlists</span>
        <ChipInput bind:values={tags} {...playlistChips(library)} />

        <label for="info-link">Spotify</label>
        <input id="info-link" bind:value={link} placeholder="https://open.spotify.com/album/…" aria-invalid={linkInvalid} />

        <label for="info-notes">Comments</label>
        <textarea id="info-notes" rows="3" bind:value={notes}></textarea>
      </div>
    {:else}
      <div class="artwork">
        <div class="preview">
          {#if cover.trim()}<img src={cover} alt="Cover" />{:else}<div class="blank">♫</div>{/if}
        </div>
        <label for="info-cover">Cover URL</label>
        <input id="info-cover" type="url" bind:value={cover} />
        <div class="row">
          <button type="button" class="aqua" disabled={!spotify || fetchingCover} onclick={useSpotifyCover}>
            {fetchingCover ? "Fetching…" : "Use Spotify Cover"}
          </button>
          <button type="button" class="aqua" disabled={!cover} onclick={() => (cover = "")}>Remove</button>
        </div>
      </div>
    {/if}
  </div>

  {#if error}<p class="error">{error}</p>{/if}

  <div class="buttons">
    <button type="button" class="aqua" onclick={ondelete}>Delete</button>
    <span class="spacer"></span>
    <button type="button" class="aqua" disabled={!canPrevious} onclick={() => navigate(-1)}>Previous</button>
    <button type="button" class="aqua" disabled={!canNext} onclick={() => navigate(1)}>Next</button>
    <span class="gap"></span>
    <button type="button" class="aqua" onclick={onclose}>Cancel</button>
    <button class="aqua default">OK</button>
  </div>
</form>

<style>
  form {
    padding: 12px 16px 14px;
  }
  .summary {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 10px;
  }
  .summary img,
  .summary .blank {
    width: 56px;
    height: 56px;
    object-fit: cover;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }
  .big {
    font-size: 13px;
    font-weight: bold;
  }
  .dim {
    color: var(--text-dim);
  }
  .blank {
    display: grid;
    place-items: center;
    color: #bbb;
    background: linear-gradient(#f4f4f4, #d8d8d8);
    font-size: 24px;
  }
  /* Aqua tabs sit on the top edge of the panel. */
  .tabs {
    display: flex;
    justify-content: center;
    margin-bottom: -11px;
    position: relative;
  }
  .tabs button {
    border: 1px solid #9b8590;
    background: linear-gradient(#fffbfc, #e8d6de);
    padding: 3px 16px;
    font: inherit;
    cursor: default;
  }
  .tabs button:first-child {
    border-radius: 10px 0 0 10px;
  }
  .tabs button:last-child {
    border-radius: 0 10px 10px 0;
    border-left: none;
  }
  .tabs button.on {
    background: linear-gradient(#fbcfe1, #ea74a5);
    border-color: #b23d6f;
    color: #000;
  }
  .panel {
    border: 1px solid #c7a3b3;
    border-radius: 4px;
    background: #f1e2e8;
    padding: 20px 14px 12px;
    min-height: 300px;
  }
  .grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 8px;
    align-items: center;
  }
  label,
  .label {
    text-align: right;
  }
  .artwork label {
    text-align: left;
  }
  input,
  textarea {
    font: inherit;
    border: 1px solid #bfa2af;
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.15);
    padding: 2px 3px;
    min-width: 0;
  }
  input.short {
    width: 60px;
  }
  textarea {
    resize: vertical;
  }
  [aria-invalid="true"] {
    border-color: #c00;
  }
  .rating {
    font-size: 13px;
  }
  .artwork {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .preview {
    align-self: center;
    width: 200px;
    height: 200px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }
  .preview img,
  .preview .blank {
    width: 100%;
    height: 100%;
    object-fit: cover;
    font-size: 64px;
  }
  .row {
    display: flex;
    gap: 6px;
  }
  .error {
    color: #c00;
    margin: 8px 0 0;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }
  .spacer {
    flex: 1;
  }
  .gap {
    width: 12px;
  }
</style>
