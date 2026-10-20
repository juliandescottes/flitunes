<script lang="ts">
  // iTunes grid view: covers with the title and artist underneath.
  import type { Album } from "../lib/model.ts";

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

  let grid: HTMLDivElement;
  $effect(() => {
    if (cursor) grid.querySelector(`[data-id="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  });
</script>

<div class="grid" bind:this={grid} tabindex="0" role="listbox" aria-label="Albums" aria-multiselectable="true">
  {#each albums as album (album.id)}
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

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 18px 12px;
    padding: 16px;
    overflow-y: auto;
    height: 100%;
    box-sizing: border-box;
    align-content: start;
    outline: none;
    background: #fff;
    user-select: none;
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
  .grid:focus-within .item.selected {
    background: #f7d3e2;
  }
</style>
