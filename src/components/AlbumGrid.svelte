<script lang="ts">
  // iTunes grid view: covers with the title and artist underneath.
  // Only the rows in view are rendered; padding stands in for the others.
  import { untrack } from "svelte";
  import type { Album } from "../lib/model.ts";
  import { revealRow, viewportHeight, visibleRows } from "../lib/virtual.ts";

  let {
    albums,
    selected,
    cursor,
    onpick,
    onopen,
    onmenu,
  }: {
    albums: Album[];
    selected: Set<string>;
    /** The item last clicked or reached with the keyboard; kept in view. */
    cursor: string | null;
    onpick: (id: string, event: MouseEvent) => void;
    onopen: (album: Album) => void;
    onmenu: (event: MouseEvent, album: Album) => void;
  } = $props();

  // Must match the CSS below.
  const PADDING = 16;
  const MIN_COLUMN = 150;
  const COLUMN_GAP = 12;
  const ROW_GAP = 18;

  let scroller: HTMLDivElement;
  let width = $state(0);
  let viewport = $state(0);
  let scrollTop = $state(0);
  // Same count as the CSS grid's auto-fill.
  const columns = $derived(Math.max(1, Math.floor((width - 2 * PADDING + COLUMN_GAP) / (MIN_COLUMN + COLUMN_GAP))));
  // Items are as tall as they are wide plus the two text lines: measured
  // from a rendered item, estimated until then.
  let measured = $state(0);
  const itemHeight = $derived(measured || (width - 2 * PADDING) / columns + 35);
  const pitch = $derived(itemHeight + ROW_GAP);
  const rowCount = $derived(Math.ceil(albums.length / columns));
  const range = $derived(visibleRows(scrollTop - PADDING, viewport, pitch, rowCount, 2));
  const shown = $derived(albums.slice(range.start * columns, range.end * columns));

  $effect(() => {
    void width;
    void shown;
    const item = scroller.querySelector(".item");
    if (item) measured = item.getBoundingClientRect().height;
  });

  $effect(() => {
    if (!cursor) return;
    const index = untrack(() => albums.findIndex((a) => a.id === cursor));
    if (index < 0) return;
    const rowTop = PADDING + Math.floor(index / untrack(() => columns)) * untrack(() => pitch);
    const top = revealRow(rowTop, untrack(() => itemHeight), scroller.scrollTop, viewportHeight(scroller));
    if (top === null) return;
    scroller.scrollTop = top;
    // Render the new rows now rather than on the next scroll event.
    scrollTop = scroller.scrollTop;
  });
</script>

<div
  class="scroller"
  bind:this={scroller}
  bind:clientWidth={width}
  bind:clientHeight={viewport}
  onscroll={() => (scrollTop = scroller.scrollTop)}
  tabindex="0"
  role="listbox"
  aria-label="Albums"
  aria-multiselectable="true"
>
  <div
    class="grid"
    style:padding-top="{PADDING + range.start * pitch}px"
    style:padding-bottom="{PADDING + (rowCount - range.end) * pitch}px"
  >
    {#each shown as album (album.id)}
      <!-- The listbox holds the focus; options are selected with the mouse or arrow keys. -->
      <!-- svelte-ignore a11y_interactive_supports_focus -->
      <div
        class="item"
        data-id={album.id}
        class:selected={selected.has(album.id)}
        role="option"
        aria-selected={selected.has(album.id)}
        onmousedown={(e) => e.button === 0 && onpick(album.id, e)}
        ondblclick={() => onopen(album)}
        oncontextmenu={(e) => onmenu(e, album)}
      >
        <div class="cover">
          {#if album.cover}
            <img src={album.cover} alt="" loading="lazy" />
          {:else}
            <div class="blank" aria-hidden="true">♫</div>
          {/if}
        </div>
        <div class="title">{album.title}</div>
        <div class="artist">{album.artists.join(", ")}</div>
      </div>
    {/each}
  </div>
</div>

<style>
  .scroller {
    overflow-y: auto;
    height: 100%;
    outline: none;
    background: #fff;
    user-select: none;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 18px 12px;
    padding: 16px;
    align-content: start;
  }
  .item {
    text-align: center;
    padding: 6px;
    border-radius: 6px;
    outline: none;
    cursor: default;
    min-width: 0;
  }
  .cover {
    aspect-ratio: 1;
    max-width: 100%;
    margin-bottom: 6px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
    background: #eee;
  }
  .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .blank {
    height: 100%;
    display: grid;
    place-items: center;
    font-size: 48px;
    color: #bbb;
    background: linear-gradient(#f4f4f4, #d8d8d8);
  }
  .title,
  .artist {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .title {
    font-weight: bold;
  }
  .artist {
    color: var(--text-dim);
  }
  .item.selected {
    background: #dadada;
  }
  .scroller:focus-within .item.selected {
    background: #f7d3e2;
  }
</style>
