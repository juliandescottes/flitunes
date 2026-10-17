<script lang="ts">
  // iTunes column browser: Genres | Artists | Albums, each starting with "All (N)".
  // Genres can be renamed in place (double-click or the context menu).
  import type { ColumnItem } from "../lib/browse.ts";

  type Column = "genre" | "artist" | "album";

  let {
    genres,
    artists,
    albumTitles,
    genre,
    artist,
    album,
    onselect,
    renamingGenre,
    ongenremenu,
    onrenamestart,
    onrenamegenre,
  }: {
    genres: ColumnItem[];
    artists: ColumnItem[];
    albumTitles: ColumnItem[];
    genre: string | null;
    artist: string | null;
    album: string | null;
    onselect: (column: Column, key: string | null) => void;
    /** Genre id being renamed, if any. */
    renamingGenre: string | null;
    ongenremenu: (event: MouseEvent, id: string) => void;
    onrenamestart: (id: string) => void;
    /** Called with the new name, or null when the rename is cancelled. */
    onrenamegenre: (id: string, name: string | null) => void;
  } = $props();

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

  const columns = $derived([
    { id: "genre" as const, title: "Genres", noun: "Genre", items: genres, selected: genre },
    { id: "artist" as const, title: "Artists", noun: "Artist", items: artists, selected: artist },
    { id: "album" as const, title: "Albums", noun: "Album", items: albumTitles, selected: album },
  ]);

  // Arrow keys move the selection within a column.
  function onkeydown(event: KeyboardEvent, column: (typeof columns)[number]) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const keys = [null, ...column.items.map((i) => i.key)];
    const i = keys.indexOf(column.selected);
    const next = Math.max(0, Math.min(keys.length - 1, i + (event.key === "ArrowDown" ? 1 : -1)));
    onselect(column.id, keys[next]);
  }
</script>

<div class="browser">
  {#each columns as column (column.id)}
    <div class="column">
      <div class="head">{column.title}</div>
      <ul role="listbox" tabindex="0" aria-label={column.title} onkeydown={(e) => onkeydown(e, column)}>
        <li
          role="option"
          aria-selected={column.selected === null}
          class:selected={column.selected === null}
          onmousedown={() => onselect(column.id, null)}
        >
          All ({column.items.length} {column.items.length === 1 ? column.noun : column.title})
        </li>
        {#each column.items as item (item.key)}
          {@const isGenre = column.id === "genre"}
          <li
            role="option"
            aria-selected={column.selected === item.key}
            class:selected={column.selected === item.key}
            onmousedown={() => onselect(column.id, item.key)}
            ondblclick={() => isGenre && onrenamestart(item.key)}
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
      </ul>
    </div>
  {/each}
</div>

<style>
  .browser {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    height: 160px;
    border-bottom: 1px solid #a5a5a5;
    background: #fff;
  }
  .column {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .column + .column {
    border-left: 1px solid #c4c4c4;
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
    padding: 1px 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: default;
  }
  li.selected {
    background: var(--select-inactive);
  }
  .rename {
    font: inherit;
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #555;
    padding: 0 2px;
    color: #000;
  }
  ul:focus li.selected {
    background: var(--select);
    color: #fff;
  }
</style>
