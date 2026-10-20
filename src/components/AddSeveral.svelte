<script lang="ts">
  // Add several albums from a list of pasted Spotify links. Each link is
  // looked up (title and cover, via oEmbed), then every row is checked and
  // completed by hand: oEmbed has no artist or year.
  import { untrack } from "svelte";
  import type { Library } from "../lib/library.svelte.ts";
  import type { Album } from "../lib/model.ts";
  import { fetchSpotifyInfo, parseSpotifyLinks } from "../lib/spotify.ts";
  import ChipInput from "./ChipInput.svelte";
  import { genreChips, parseYear, playlistChips, splitArtists } from "./fields.ts";

  let {
    library,
    text: initialText,
    onadded,
    oncancel,
    onsingle,
  }: {
    library: Library;
    text: string;
    onadded: (albums: Album[]) => void;
    oncancel: () => void;
    onsingle: () => void;
  } = $props();

  interface Row {
    /** Spotify URI. */
    uri: string;
    title: string;
    artists: string;
    year: string;
    cover: string | null;
    status: "loading" | "done" | "failed";
    duplicate: boolean;
    include: boolean;
  }

  let text = $state(untrack(() => initialText));
  let rows = $state<Row[] | null>(null);
  let genres = $state<string[]>([]);
  let tags = $state<string[]>([]);
  let error = $state<string | null>(null);
  let request = 0;

  const parsed = $derived(parseSpotifyLinks(text));
  const included = $derived(rows?.filter((r) => r.include) ?? []);
  const loading = $derived(rows?.some((r) => r.status === "loading") ?? false);

  // Look up a few links at a time.
  const CONCURRENCY = 4;

  async function lookUp(event: SubmitEvent) {
    event.preventDefault();
    const req = ++request;
    error = null;
    rows = parsed.uris.map((uri) => {
      const duplicate = library.findBySpotify(uri).length > 0;
      return { uri, title: "", artists: "", year: "", cover: null, status: "loading", duplicate, include: !duplicate };
    });
    const queue = [...rows];
    const worker = async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        try {
          const info = await fetchSpotifyInfo(row.uri);
          if (req !== request) return;
          row.title = info.title;
          row.cover = info.cover;
          row.status = "done";
        } catch {
          if (req !== request) return;
          row.status = "failed";
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    try {
      const albums = await library.addAlbums(
        included.map((row) => ({
          title: row.title,
          artists: splitArtists(row.artists),
          year: parseYear(row.year),
          genres: [...genres],
          tags: [...tags],
          spotify: row.uri,
          cover: row.cover,
        })),
      );
      onadded(albums);
    } catch (e) {
      error = (e as Error).message;
    }
  }

  function back() {
    request++;
    rows = null;
  }
</script>

{#if rows === null}
  <form class="add" onsubmit={lookUp}>
    <div class="head">
      <h2>Add Several Albums</h2>
      <button type="button" class="link" onclick={onsingle}>Add One…</button>
    </div>
    <label>
      Spotify links <span class="sub">(one per line)</span>
      <!-- svelte-ignore a11y_autofocus -->
      <textarea rows="10" bind:value={text} autofocus placeholder="https://open.spotify.com/album/…"></textarea>
    </label>
    {#if parsed.invalid.length > 0}
      <p class="hint warning">
        Not album or playlist links, will be skipped: {parsed.invalid.slice(0, 3).join(", ")}{parsed.invalid.length > 3 ? "…" : ""}
      </p>
    {/if}
    <div class="row actions">
      <span class="sub">{parsed.uris.length} {parsed.uris.length === 1 ? "album" : "albums"}</span>
      <span class="spacer"></span>
      <button type="button" class="aqua" onclick={oncancel}>Cancel</button>
      <button class="aqua default" disabled={parsed.uris.length === 0}>Look Up</button>
    </div>
  </form>
{:else}
  <form class="add" onsubmit={submit}>
    <div class="head">
      <h2>Add Several Albums</h2>
      <span class="sub">Spotify links only give the title and cover: fill in the artists.</span>
    </div>

    <div class="table">
      <table>
        <thead>
          <tr>
            <th class="check"><span class="visually-hidden">Add</span></th>
            <th class="art"></th>
            <th>Name</th>
            <th>Artist</th>
            <th class="year">Year</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.uri)}
            <tr class:excluded={!row.include}>
              <td class="check">
                <input type="checkbox" bind:checked={row.include} aria-label="Add {row.title || 'this album'}" />
              </td>
              <td class="art">
                {#if row.cover}<img src={row.cover} alt="" />{:else}<div class="blank">♫</div>{/if}
              </td>
              <td>
                <input
                  bind:value={row.title}
                  required={row.include}
                  disabled={!row.include}
                  placeholder={row.status === "loading" ? "Looking up…" : row.status === "failed" ? "Lookup failed: type the name" : ""}
                  aria-label="Name"
                />
                {#if row.duplicate}<div class="note">Already in the library</div>{/if}
              </td>
              <td>
                <input bind:value={row.artists} required={row.include} disabled={!row.include} aria-label="Artist" />
              </td>
              <td class="year">
                <input bind:value={row.year} disabled={!row.include} inputmode="numeric" aria-label="Year" />
              </td>
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

    {#if error}<p class="hint error">{error}</p>{/if}

    <div class="row actions">
      <button type="button" class="aqua" onclick={back}>Back</button>
      <span class="spacer"></span>
      <button type="button" class="aqua" onclick={oncancel}>Cancel</button>
      <button class="aqua default" disabled={loading || included.length === 0}>
        {loading ? "Looking Up…" : `Add ${included.length} ${included.length === 1 ? "Album" : "Albums"}`}
      </button>
    </div>
  </form>
{/if}

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
  .head .link {
    margin-left: auto;
  }
  label,
  .field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  input,
  textarea {
    font: inherit;
  }
  textarea {
    resize: vertical;
    font-size: 11px;
  }
  .table {
    max-height: 45vh;
    overflow: auto;
    border: 1px solid #bfa2af;
    background: #fff;
  }
  table {
    width: 100%;
    border-collapse: collapse;
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
    padding: 2px 4px;
    vertical-align: top;
  }
  tbody tr:nth-child(even) td {
    background: var(--stripe);
  }
  tr.excluded td {
    color: var(--text-dim);
  }
  td input:not([type="checkbox"]) {
    width: 100%;
    box-sizing: border-box;
  }
  td input:disabled {
    opacity: 0.5;
  }
  .check {
    width: 18px;
    padding-top: 9px;
  }
  .art {
    width: 32px;
  }
  .art img,
  .art .blank {
    display: block;
    width: 32px;
    height: 32px;
    object-fit: cover;
  }
  .blank {
    display: grid;
    place-items: center;
    color: #bbb;
    background: #eee;
  }
  th.year,
  td.year {
    width: 48px;
  }
  .note {
    color: #a60;
    font-size: 10px;
  }
  .shared {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 10px;
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
    margin: 4px 0;
    font-size: 0.9em;
  }
  .error {
    color: #c00;
  }
  .warning {
    color: #a60;
  }
  .link {
    border: none;
    background: none;
    color: #c2407a;
    cursor: pointer;
    padding: 0;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
