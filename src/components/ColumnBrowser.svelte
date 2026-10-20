<script lang="ts">
  // iTunes column browser: Genres | Artists | Albums, each starting with "All (N)".
  // Genres can be renamed in place (double-click or the context menu).
  // Double-click or Enter on an album opens it in Spotify.
  // Its height is resized by dragging its bottom edge. Each column only
  // renders the entries in view (entries have a fixed height).
  import type { ColumnItem } from "../lib/browse.ts";
  import { revealRow, viewportHeight, visibleRows } from "../lib/virtual.ts";

  type Column = "genre" | "artist" | "album";

  let {
    genres,
    artists,
    albumTitles,
    genre,
    artist,
    album,
    onselect,
    onopenalbum,
    renamingGenre,
    ongenremenu,
    onrenamestart,
    onrenamegenre,
    height = $bindable(),
  }: {
    genres: ColumnItem[];
    artists: ColumnItem[];
    albumTitles: ColumnItem[];
    genre: string | null;
    artist: string | null;
    album: string | null;
    onselect: (column: Column, key: string | null) => void;
    /** Opens the album with this title in Spotify. */
    onopenalbum: (title: string) => void;
    /** Genre id being renamed, if any. */
    renamingGenre: string | null;
    ongenremenu: (event: MouseEvent, id: string) => void;
    onrenamestart: (id: string) => void;
    /** Called with the new name, or null when the rename is cancelled. */
    onrenamegenre: (id: string, name: string | null) => void;
    /** Height in pixels. */
    height: number;
  } = $props();

  /** Entry height in pixels, matching the CSS. */
  const ROW = 16;
  const MIN_HEIGHT = 60;
  // Room left for the album list below.
  const MIN_LIST_HEIGHT = 100;
  let browser: HTMLDivElement;

  function clampHeight(value: number): number {
    const available = (browser.parentElement?.clientHeight ?? Infinity) - MIN_LIST_HEIGHT;
    return Math.round(Math.max(MIN_HEIGHT, Math.min(available, value)));
  }

  function startResize(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    // Start from the shown height: a smaller window may have shrunk it.
    const startHeight = clampHeight(height);
    const move = (e: PointerEvent) => (height = clampHeight(startHeight + e.clientY - startY));
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  function resizeKeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 50 : 10;
    if (event.key === "ArrowUp") height = clampHeight(clampHeight(height) - step);
    else if (event.key === "ArrowDown") height = clampHeight(clampHeight(height) + step);
    else return;
    event.preventDefault();
  }

  // Focuses and selects the rename field when it appears.
  function renameField(input: HTMLInputElement) {
    input.focus();
    input.select();
  }

  function onRenameKeydown(event: KeyboardEvent, id: string) {
    event.stopPropagation();
    if (event.key === "Enter") onrenamegenre(id, (event.currentTarget as HTMLInputElement).value);
    else if (event.key === "Escape") onrenamegenre(id, null);
  }

  const lists: Record<Column, HTMLUListElement | undefined> = { genre: undefined, artist: undefined, album: undefined };
  const scrollTops = $state<Record<Column, number>>({ genre: 0, artist: 0, album: 0 });
  const viewports = $state<Record<Column, number>>({ genre: 0, artist: 0, album: 0 });

  // Rows below "All", which is always rendered.
  function range(id: Column, count: number) {
    return visibleRows(scrollTops[id] - ROW, viewports[id], ROW, count);
  }

  const columns = $derived([
    { id: "genre" as const, title: "Genres", noun: "Genre", items: genres, selected: genre },
    { id: "artist" as const, title: "Artists", noun: "Artist", items: artists, selected: artist },
    { id: "album" as const, title: "Albums", noun: "Album", items: albumTitles, selected: album },
  ]);

  // Arrow keys move the selection within a column.
  function onkeydown(event: KeyboardEvent, column: (typeof columns)[number]) {
    if (event.key === "Enter" && column.id === "album" && column.selected !== null) {
      event.preventDefault();
      onopenalbum(column.selected);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const keys = [null, ...column.items.map((i) => i.key)];
    const i = keys.indexOf(column.selected);
    const next = Math.max(0, Math.min(keys.length - 1, i + (event.key === "ArrowDown" ? 1 : -1)));
    onselect(column.id, keys[next]);
    const list = lists[column.id];
    const top = list && revealRow(next * ROW, ROW, list.scrollTop, viewportHeight(list));
    if (list && top != null) {
      list.scrollTop = top;
      scrollTops[column.id] = list.scrollTop;
    }
  }
</script>

<div class="browser" bind:this={browser} style:height="{height}px">
  {#each columns as column (column.id)}
    {@const rows = range(column.id, column.items.length)}
    <div class="column">
      <div class="head">{column.title}</div>
      <ul
        role="listbox"
        tabindex="0"
        aria-label={column.title}
        onkeydown={(e) => onkeydown(e, column)}
        bind:this={lists[column.id]}
        bind:clientHeight={viewports[column.id]}
        onscroll={(e) => (scrollTops[column.id] = e.currentTarget.scrollTop)}
      >
        <li
          role="option"
          aria-selected={column.selected === null}
          class:selected={column.selected === null}
          onmousedown={() => onselect(column.id, null)}
        >
          All ({column.items.length} {column.items.length === 1 ? column.noun : column.title})
        </li>
        {#if rows.start > 0}
          <li class="spacer" role="presentation" style:height="{rows.start * ROW}px"></li>
        {/if}
        {#each column.items.slice(rows.start, rows.end) as item (item.key)}
          {@const isGenre = column.id === "genre"}
          <li
            role="option"
            aria-selected={column.selected === item.key}
            class:selected={column.selected === item.key}
            onmousedown={() => onselect(column.id, item.key)}
            ondblclick={() => {
              if (isGenre) onrenamestart(item.key);
              else if (column.id === "album") onopenalbum(item.key);
            }}
            oncontextmenu={(e) => {
              if (!isGenre) return;
              onselect("genre", item.key);
              ongenremenu(e, item.key);
            }}
          >
            {#if isGenre && renamingGenre === item.key}
              <input
                class="rename"
                value={item.label}
                aria-label="Genre name"
                use:renameField
                onmousedown={(e) => e.stopPropagation()}
                onkeydown={(e) => onRenameKeydown(e, item.key)}
                onblur={(e) => onrenamegenre(item.key, e.currentTarget.value)}
              />
            {:else}
              {item.label}
            {/if}
          </li>
        {/each}
        {#if rows.end < column.items.length}
          <li class="spacer" role="presentation" style:height="{(column.items.length - rows.end) * ROW}px"></li>
        {/if}
      </ul>
    </div>
  {/each}
  <!-- A focusable separator is an ARIA widget (resized with the arrow keys), which Svelte doesn't know. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="splitter"
    role="separator"
    aria-orientation="horizontal"
    aria-label="Resize the column browser"
    aria-valuenow={height}
    aria-valuemin={MIN_HEIGHT}
    tabindex="0"
    onpointerdown={startResize}
    onkeydown={resizeKeydown}
  ></div>
</div>

<style>
  .browser {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    position: relative;
    flex-shrink: 1;
    min-height: 60px;
    border-bottom: 1px solid #bfa2af;
    background: #fff;
  }
  /* A grab area straddling the bottom border, like iTunes. */
  .splitter {
    position: absolute;
    left: 0;
    right: 0;
    bottom: -4px;
    height: 7px;
    z-index: 2;
    cursor: row-resize;
    touch-action: none;
    outline: none;
  }
  .splitter:focus-visible {
    background: var(--select);
    opacity: 0.5;
  }
  .column {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .column + .column {
    border-left: 1px solid #d6bdc8;
  }
  .head {
    background: var(--header);
    border-bottom: 1px solid var(--header-border);
    padding: 1px 6px;
    font-weight: normal;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
    outline: none;
  }
  li {
    /* Entries must be exactly 16px (ROW) for the virtual scrolling. */
    box-sizing: border-box;
    height: 16px;
    line-height: 14px;
    padding: 1px 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: default;
  }
  li.spacer {
    padding: 0;
  }
  li.selected {
    background: var(--select-inactive);
  }
  .rename {
    font: inherit;
    width: 100%;
    box-sizing: border-box;
    height: 14px;
    border: 1px solid #555;
    padding: 0 2px;
    color: #000;
  }
  ul:focus li.selected {
    background: var(--select);
    color: #fff;
  }
</style>
