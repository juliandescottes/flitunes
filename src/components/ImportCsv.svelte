<script lang="ts">
  // Import albums from a CSV file (e.g. a Last.fm export): every row is a
  // candidate, and only the ticked ones are added. A play-count threshold
  // narrows long lists down.
  import { parseCsvAlbums } from "../lib/csv.ts";
  import type { Library } from "../lib/library.svelte.ts";
  import { albumMatchKey, type Album } from "../lib/model.ts";
  import { parseSpotifyAlbumId, spotifyUri } from "../lib/spotify.ts";
  import ChipInput from "./ChipInput.svelte";
  import { genreChips, playlistChips, splitArtists } from "./fields.ts";

  let {
    library,
    onadded,
    oncancel,
  }: { library: Library; onadded: (albums: Album[]) => void; oncancel: () => void } = $props();

  interface Row {
    key: number;
    title: string;
    artist: string;
    year: number | null;
    plays: number | null;
    spotify: string | null;
    duplicate: boolean;
    include: boolean;
  }

  let rows = $state<Row[] | null>(null);
  let fileName = $state("");
  let minPlays = $state(0);
  let genres = $state<string[]>([]);
  let tags = $state<string[]>([]);
  let error = $state<string | null>(null);

  const hasPlays = $derived(rows?.some((r) => r.plays !== null) ?? false);
  const shown = $derived(rows?.filter((r) => !hasPlays || (r.plays ?? 0) >= minPlays) ?? []);
  const included = $derived(shown.filter((r) => r.include));

  async function load(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    error = null;
    try {
      const existing = new Set(library.albums.map((a) => albumMatchKey(a.artists[0] ?? "", a.title)));
      rows = parseCsvAlbums(await file.text()).map((a, key) => {
        const id = a.spotify ? parseSpotifyAlbumId(a.spotify) : null;
        const duplicate =
          existing.has(albumMatchKey(a.artist, a.title)) || (id !== null && library.findBySpotify(spotifyUri(id)).length > 0);
        return { ...a, key, spotify: id && spotifyUri(id), duplicate, include: false };
      });
      fileName = file.name;
      if (rows.length === 0) error = "No albums found in this file.";
    } catch (e) {
      error = (e as Error).message;
    }
  }

  function tickShown(include: boolean) {
    for (const row of shown) if (!row.duplicate || !include) row.include = include;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    try {
      const albums = await library.addAlbums(
        included.map((row) => ({
          title: row.title,
          artists: splitArtists(row.artist),
          year: row.year,
          genres: [...genres],
          tags: [...tags],
          spotify: row.spotify,
        })),
      );
      onadded(albums);
    } catch (e) {
      error = (e as Error).message;
    }
  }
</script>

<form class="add" onsubmit={submit}>
  <div class="head">
    <h2>Import Albums from CSV</h2>
    {#if rows}<span class="sub">{fileName}</span>{/if}
  </div>

  {#if rows === null}
    <p>
      Choose a CSV file with a header row. It needs <strong>album</strong> and <strong>artist</strong> columns;
      <strong>year</strong>, <strong>plays</strong> and a <strong>spotify</strong> link are used when present.
      You pick which albums to add on the next step.
    </p>
    <label class="aqua file">
      Choose File…
      <input type="file" accept=".csv,text/csv" onchange={load} />
    </label>
  {:else}
    <div class="row filters">
      {#if hasPlays}
        <label class="inline">
          Show albums with at least
          <!-- Enter would submit the form and add the albums. -->
          <input
            type="number"
            min="0"
            bind:value={minPlays}
            class="short"
            onkeydown={(e) => e.key === "Enter" && e.preventDefault()}
          />
          plays
        </label>
      {/if}
      <span class="sub">{shown.length} of {rows.length} shown</span>
      <span class="spacer"></span>
      <button type="button" class="aqua" onclick={() => tickShown(true)}>Tick All Shown</button>
      <button type="button" class="aqua" onclick={() => tickShown(false)}>Untick All</button>
    </div>

    <div class="table">
      <table>
        <thead>
          <tr>
            <th class="check"><span class="visually-hidden">Add</span></th>
            <th>Name</th>
            <th>Artist</th>
            <th class="num">Year</th>
            {#if hasPlays}<th class="num">Plays</th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each shown as row (row.key)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
            <!-- Clicking anywhere on the row toggles it; the checkbox is the keyboard path. -->
            <tr
              class:on={row.include}
              onclick={(e) => {
                if (!(e.target instanceof HTMLInputElement)) row.include = !row.include;
              }}
            >
              <td class="check">
                <input type="checkbox" bind:checked={row.include} aria-label="Add {row.artist} – {row.title}" />
              </td>
              <td>
                {row.title}
                {#if row.duplicate}<span class="note">Already in the library</span>{/if}
              </td>
              <td>{row.artist}</td>
              <td class="num">{row.year ?? ""}</td>
              {#if hasPlays}<td class="num">{row.plays ?? ""}</td>{/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="shared">
      <div class="field">
        Genres <span class="sub">(for all of them)</span>
        <ChipInput bind:values={genres} primary {...genreChips(library)} />
      </div>
      <div class="field">
        Playlists <span class="sub">(for all of them)</span>
        <ChipInput bind:values={tags} {...playlistChips(library)} />
      </div>
    </div>
  {/if}

  {#if error}<p class="hint error">{error}</p>{/if}

  <div class="row actions">
    {#if rows}<button type="button" class="aqua" onclick={() => (rows = null)}>Back</button>{/if}
    <span class="spacer"></span>
    <button type="button" class="aqua" onclick={oncancel}>Cancel</button>
    {#if rows}
      <button class="aqua default" disabled={included.length === 0}>
        Add {included.length} {included.length === 1 ? "Album" : "Albums"}
      </button>
    {/if}
  </div>
</form>

<style>
  .add {
    padding: 14px 18px;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 10px;
  }
  h2 {
    margin: 0;
    font-size: 13px;
  }
  p {
    margin: 0 0 12px;
    line-height: 1.5;
  }
  input {
    font: inherit;
  }
  .file {
    display: inline-block;
    position: relative;
  }
  .file input {
    position: absolute;
    inset: 0;
    opacity: 0;
  }
  .filters {
    margin-bottom: 6px;
    flex-wrap: wrap;
  }
  .inline {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .short {
    width: 52px;
  }
  .table {
    max-height: 50vh;
    overflow: auto;
    border: 1px solid #a5a5a5;
    background: #fff;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    user-select: none;
  }
  th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--header);
    border-bottom: 1px solid var(--header-border);
    font-weight: normal;
    text-align: left;
    padding: 1px 4px;
  }
  td {
    padding: 1px 4px;
    height: 18px;
    cursor: default;
  }
  tbody tr:nth-child(even) td {
    background: var(--stripe);
  }
  tbody tr:not(.on) td {
    color: var(--text-dim);
  }
  .check {
    width: 18px;
  }
  .num {
    width: 48px;
    text-align: right;
  }
  .note {
    margin-left: 6px;
    color: #a60;
    font-size: 10px;
  }
  .shared {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 10px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .actions {
    margin-top: 12px;
  }
  .spacer {
    flex: 1;
  }
  .sub {
    color: #666;
    font-size: 0.85em;
  }
  .hint {
    margin: 6px 0 0;
  }
  .error {
    color: #c00;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
