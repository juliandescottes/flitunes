<script lang="ts">
  // "Multiple Item Information", like iTunes: each field has a checkbox that
  // gets ticked when you edit it, and only ticked fields are applied.
  import { untrack } from "svelte";
  import type { Library } from "../lib/library.svelte.ts";
  import type { Album } from "../lib/model.ts";
  import ChipInput from "./ChipInput.svelte";
  import { genreChips, joinArtists, parseYear, playlistChips, splitArtists } from "./fields.ts";
  import StarRating from "./StarRating.svelte";

  let { library, albums, onclose }: { library: Library; albums: Album[]; onclose: () => void } = $props();

  // Snapshot of the selection when the window opened.
  const selection = untrack(() => albums);
  const ids = selection.map((a) => a.id);

  const same = (get: (a: Album) => unknown) =>
    selection.every((a) => JSON.stringify(get(a)) === JSON.stringify(get(selection[0])));
  const mixed = (get: (a: Album) => unknown) => !same(get);

  /** The value shared by every album, or the fallback when they differ. */
  function common<T>(get: (a: Album) => T, fallback: T): T {
    return same(get) ? get(selection[0]) : fallback;
  }

  const initialGenres = common((a) => [...a.genres], [] as string[]);
  let artists = $state(common((a) => joinArtists(a.artists), ""));
  let artistSort = $state(common((a) => a.artistSort ?? "", ""));
  let year = $state(common((a) => a.year?.toString() ?? "", ""));
  let genres = $state([...initialGenres]);
  let rating = $state(common((a) => a.rating, null));
  let addTags = $state<string[]>([]);
  let removeTags = $state<string[]>([]);

  let apply = $state({ artists: false, artistSort: false, year: false, genres: false, rating: false });
  let error = $state<string | null>(null);

  // The genre chips have no input event to hook, so tick the box on change.
  $effect(() => {
    if (JSON.stringify(genres) !== JSON.stringify(initialGenres)) apply.genres = true;
  });

  const inUse = [...new Set(selection.flatMap((a) => a.tags))].sort();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    try {
      const parsedYear = apply.year ? parseYear(year) : null;
      await library.updateAlbums(ids, (album) => ({
        ...(apply.artists && { artists: splitArtists(artists) }),
        ...(apply.artistSort && { artistSort }),
        ...(apply.year && { year: parsedYear }),
        ...(apply.genres && { genres }),
        ...(apply.rating && { rating }),
        tags: [...album.tags, ...addTags].filter((t) => !removeTags.includes(t)),
      }));
      onclose();
    } catch (e) {
      error = (e as Error).message;
    }
  }
</script>

<form onsubmit={submit}>
  <p class="intro">Editing {selection.length} albums. Only the ticked fields are changed.</p>

  <div class="grid">
    <input type="checkbox" aria-label="Apply artist" bind:checked={apply.artists} />
    <label for="multi-artist">Artist</label>
    <input id="multi-artist" bind:value={artists} placeholder={mixed((a) => a.artists) ? "Mixed" : ""} oninput={() => (apply.artists = true)} />

    <input type="checkbox" aria-label="Apply sort artist" bind:checked={apply.artistSort} />
    <label for="multi-sort">Sort Artist</label>
    <input id="multi-sort" bind:value={artistSort} placeholder={mixed((a) => a.artistSort) ? "Mixed" : ""} oninput={() => (apply.artistSort = true)} />

    <input type="checkbox" aria-label="Apply year" bind:checked={apply.year} />
    <label for="multi-year">Year</label>
    <input id="multi-year" class="short" bind:value={year} inputmode="numeric" placeholder={mixed((a) => a.year) ? "Mixed" : ""} oninput={() => (apply.year = true)} />

    <input type="checkbox" aria-label="Apply genres" bind:checked={apply.genres} />
    <span class="label">Genres</span>
    <ChipInput
      bind:values={genres}
      primary
      {...genreChips(library)}
      placeholder={mixed((a) => a.genres) ? "Mixed" : "Add genre"}
    />

    <input type="checkbox" aria-label="Apply rating" bind:checked={apply.rating} />
    <span class="label">Rating</span>
    <span class="rating show-dots">
      <StarRating value={rating} onchange={(r) => ((rating = r), (apply.rating = true))} />
    </span>

    <span></span>
    <span class="label">Add to</span>
    <ChipInput bind:values={addTags} {...playlistChips(library)} />

    <span></span>
    <span class="label">Remove from</span>
    <ChipInput bind:values={removeTags} suggestions={inUse} resolve={(name) => name} placeholder="Remove from playlist" />
  </div>

  {#if error}<p class="error">{error}</p>{/if}

  <div class="buttons">
    <button type="button" class="aqua" onclick={onclose}>Cancel</button>
    <button class="aqua default">OK</button>
  </div>
</form>

<style>
  form {
    padding: 12px 16px 14px;
  }
  .intro {
    margin: 0 0 10px;
    color: #444;
  }
  .grid {
    display: grid;
    grid-template-columns: auto max-content 1fr;
    gap: 6px 8px;
    align-items: center;
    border: 1px solid #c7a3b3;
    border-radius: 4px;
    background: #f1e2e8;
    padding: 12px 14px;
  }
  label,
  .label {
    text-align: right;
  }
  input:not([type="checkbox"]) {
    font: inherit;
    border: 1px solid #bfa2af;
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.15);
    padding: 2px 3px;
    min-width: 0;
  }
  input.short {
    width: 60px;
  }
  .rating {
    font-size: 13px;
  }
  .error {
    color: #c00;
    margin: 8px 0 0;
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 12px;
  }
</style>
