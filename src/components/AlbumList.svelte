<script lang="ts">
  // iTunes list view: striped rows, sortable column headers.
  import { genreName, type SortDir, type SortKey } from "../lib/browse.ts";
  import type { Album } from "../lib/model.ts";

  let {
    albums,
    genreNames,
    selectedId = $bindable(),
    sortKey,
    sortDir,
    onsort,
    onopen,
  }: {
    albums: Album[];
    genreNames: Map<string, string>;
    selectedId: string | null;
    sortKey: SortKey;
    sortDir: SortDir;
    onsort: (key: SortKey) => void;
    onopen: (album: Album) => void;
  } = $props();

  const columns: { key: SortKey; label: string; class: string }[] = [
    { key: "title", label: "Name", class: "name" },
    { key: "artist", label: "Artist", class: "artist" },
    { key: "year", label: "Year", class: "year" },
    { key: "genre", label: "Genre", class: "genre" },
    { key: "rating", label: "Rating", class: "rating" },
    { key: "addedAt", label: "Date Added", class: "added" },
  ];

  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });
  const stars = (rating: number | null) => (rating ? "★".repeat(rating) : "");

  let body: HTMLTableSectionElement;
  $effect(() => {
    if (selectedId) body.querySelector(`[data-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest" });
  });
</script>

<div class="scroller" tabindex="0" role="grid" aria-label="Albums">
  <table>
    <thead>
      <tr>
        {#each columns as c (c.key)}
          <th class={c.class} class:sorted={sortKey === c.key} aria-sort={sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
            <button onclick={() => onsort(c.key)}>
              {c.label}
              {#if sortKey === c.key}<span class="arrow">{sortDir === "asc" ? "▲" : "▼"}</span>{/if}
            </button>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody bind:this={body}>
      {#each albums as album (album.id)}
        <tr
          data-id={album.id}
          class:selected={album.id === selectedId}
          aria-selected={album.id === selectedId}
          onmousedown={() => (selectedId = album.id)}
          ondblclick={() => onopen(album)}
        >
          <td class="name">
            {album.title}
            {#if album.spotify}
              <a class="go" href={album.spotify} title="Open in Spotify" aria-label="Open in Spotify" onmousedown={(e) => e.stopPropagation()}>➜</a>
            {/if}
          </td>
          <td class="artist">{album.artists.join(", ")}</td>
          <td class="year">{album.year ?? ""}</td>
          <td class="genre">{genreName(album, genreNames) ?? ""}</td>
          <td class="rating">{stars(album.rating)}</td>
          <td class="added">{dateFormat.format(new Date(album.addedAt))}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .scroller {
    outline: none;
    overflow: auto;
    height: 100%;
    /* Keep the stripes going below the last row, like iTunes. */
    background: repeating-linear-gradient(#fff 0 18px, var(--stripe) 18px 36px);
    background-attachment: local;
    background-position: 0 18px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--header);
    border-bottom: 1px solid var(--header-border);
    border-right: 1px solid #c8c8c8;
    padding: 0;
    font-weight: normal;
    text-align: left;
  }
  th.sorted {
    background: linear-gradient(#c5d8f2, #92b3e1);
  }
  th button {
    display: flex;
    justify-content: space-between;
    width: 100%;
    border: none;
    background: none;
    padding: 1px 5px;
    text-align: left;
    cursor: default;
  }
  .arrow {
    font-size: 8px;
    color: #444;
    align-self: center;
  }
  .name {
    width: 32%;
  }
  .artist {
    width: 22%;
  }
  .year {
    width: 6%;
  }
  .genre {
    width: 13%;
  }
  .rating {
    width: 9%;
  }
  .added {
    width: 18%;
  }
  td {
    height: 18px;
    padding: 0 5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: default;
  }
  tbody tr:nth-child(odd) td {
    background: #fff;
  }
  tbody tr:nth-child(even) td {
    background: var(--stripe);
  }
  tbody tr.selected td {
    background: var(--select-inactive);
  }
  .scroller:focus-within tbody tr.selected td {
    background: var(--select);
    color: #fff;
  }
  td.rating {
    letter-spacing: 1px;
  }
  .go {
    display: none;
    margin-left: 4px;
    padding: 0 3px;
    border-radius: 7px;
    background: #9a9a9a;
    color: #fff;
    font-size: 9px;
    text-decoration: none;
  }
  tr:hover .go,
  tr.selected .go {
    display: inline;
  }
  .scroller:focus-within tr.selected .go {
    background: #fff;
    color: var(--select);
  }
</style>
