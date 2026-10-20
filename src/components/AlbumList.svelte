<script lang="ts">
  // iTunes list view: striped rows, sortable column headers, inline ratings.
  // Only the rows in view are rendered (rows have a fixed height), so long
  // libraries stay fast.
  import { untrack } from "svelte";
  import { genreName, type SortDir, type SortKey } from "../lib/browse.ts";
  import type { Album } from "../lib/model.ts";
  import { revealRow, viewportHeight, visibleRows } from "../lib/virtual.ts";
  import StarRating from "./StarRating.svelte";

  let {
    albums,
    genreNames,
    selected,
    cursor,
    sortKey,
    sortDir,
    onsort,
    onpick,
    onopen,
    onrate,
    onmenu,
  }: {
    albums: Album[];
    genreNames: Map<string, string>;
    selected: Set<string>;
    /** The row last clicked or reached with the keyboard; kept in view. */
    cursor: string | null;
    sortKey: SortKey;
    sortDir: SortDir;
    onsort: (key: SortKey) => void;
    onpick: (id: string, event: MouseEvent) => void;
    onopen: (album: Album) => void;
    onrate: (album: Album, rating: number | null) => void;
    onmenu: (event: MouseEvent, album: Album) => void;
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

  /** Row height in pixels, matching the CSS. */
  const ROW = 18;

  let scroller: HTMLDivElement;
  let scrollTop = $state(0);
  let viewport = $state(0);
  let headerHeight = $state(0);
  const range = $derived(visibleRows(scrollTop - headerHeight, viewport, ROW, albums.length));
  const shown = $derived(albums.slice(range.start, range.end));

  $effect(() => {
    if (!cursor) return;
    const index = untrack(() => albums.findIndex((a) => a.id === cursor));
    if (index < 0) return;
    const top = revealRow(headerHeight + index * ROW, ROW, scroller.scrollTop, viewportHeight(scroller), headerHeight);
    if (top === null) return;
    scroller.scrollTop = top;
    // Render the new rows now rather than on the next scroll event.
    scrollTop = scroller.scrollTop;
  });
</script>

<div
  class="scroller"
  tabindex="0"
  role="grid"
  aria-label="Albums"
  aria-multiselectable="true"
  aria-rowcount={albums.length + 1}
  bind:this={scroller}
  bind:clientHeight={viewport}
  onscroll={() => (scrollTop = scroller.scrollTop)}
>
  <table>
    <thead bind:offsetHeight={headerHeight}>
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
    <tbody>
      {#if range.start > 0}
        <tr class="spacer" aria-hidden="true"><td colspan="6" style:height="{range.start * ROW}px"></td></tr>
      {/if}
      {#each shown as album, i (album.id)}
        {@const isSelected = selected.has(album.id)}
        <tr
          data-id={album.id}
          aria-rowindex={range.start + i + 2}
          class:alt={(range.start + i) % 2 === 1}
          class:selected={isSelected}
          aria-selected={isSelected}
          onmousedown={(e) => e.button === 0 && onpick(album.id, e)}
          ondblclick={() => onopen(album)}
          oncontextmenu={(e) => onmenu(e, album)}
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
          <td class="rating" class:show-dots={isSelected}>
            <StarRating value={album.rating} onchange={(r) => onrate(album, r)} />
          </td>
          <td class="added">{dateFormat.format(new Date(album.addedAt))}</td>
        </tr>
      {/each}
      {#if range.end < albums.length}
        <tr class="spacer" aria-hidden="true">
          <td colspan="6" style:height="{(albums.length - range.end) * ROW}px"></td>
        </tr>
      {/if}
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
    user-select: none;
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
    /* A shadow, not a border: collapsed borders would make the header 17.5px. */
    box-shadow: inset 0 -1px 0 var(--header-border);
    border-right: 1px solid #c8c8c8;
    padding: 0;
    font-weight: normal;
    text-align: left;
  }
  th.sorted {
    background: linear-gradient(#f7d3e2, #e8a6c2);
  }
  th button {
    display: flex;
    justify-content: space-between;
    width: 100%;
    /* One row tall, like the stripes below assume. */
    height: 18px;
    border: none;
    background: none;
    padding: 0 5px;
    align-items: center;
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
    /* Rows must be exactly 18px (ROW) for the virtual scrolling. */
    box-sizing: border-box;
    height: 18px;
    max-height: 18px;
    line-height: 18px;
    padding: 0 5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: default;
  }
  tbody tr td {
    background: #fff;
  }
  tbody tr.alt td {
    background: var(--stripe);
  }
  tbody tr.spacer td {
    padding: 0;
    background: none;
  }
  tbody tr.selected td {
    background: var(--select-inactive);
  }
  .scroller:focus-within tbody tr.selected td {
    background: var(--select);
    color: #fff;
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
    /* Without this, its smaller font makes the line, and so the row, taller. */
    line-height: 1;
    vertical-align: middle;
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
