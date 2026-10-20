<script lang="ts">
  // iTunes 10 source list: LIBRARY and PLAYLISTS sections. Playlists are tags.
  // The Add button sits at the bottom, clear of the window's rounded corner.
  import type { Source } from "../lib/browse.ts";

  let {
    source = $bindable(),
    playlists,
    onadd,
  }: { source: Source; playlists: string[]; onadd: () => void } = $props();

  const isSelected = (s: Source) =>
    s.kind === source.kind && (s.kind !== "playlist" || (source.kind === "playlist" && s.tag === source.tag));
</script>

{#snippet item(s: Source, label: string, icon: "music" | "recent" | "playlist")}
  <li>
    <button class:selected={isSelected(s)} aria-current={isSelected(s)} onclick={() => (source = s)}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" class="icon {icon}">
        {#if icon === "music"}
          <path d="M6 3l7-1.5v9a2 2 0 1 1-1.5-1.9V4.4L7.5 5.3v7.2A2 2 0 1 1 6 10.6z" />
        {:else if icon === "recent"}
          <path d="M8 1.5l1.9 4 4.4.5-3.3 3 .9 4.4L8 11.2l-3.9 2.2.9-4.4-3.3-3 4.4-.5z" />
        {:else}
          <path d="M2 3h9v1.6H2zm0 3.5h9v1.6H2zm0 3.5h6v1.6H2zm9 0l4 2-4 2z" />
        {/if}
      </svg>
      <span>{label}</span>
    </button>
  </li>
{/snippet}

<div class="sources">
  <nav aria-label="Sources">
    <h3>Library</h3>
    <ul>
      {@render item({ kind: "music" }, "Music", "music")}
      {@render item({ kind: "recent" }, "Recently Added", "recent")}
    </ul>

    <h3>Playlists</h3>
    {#if playlists.length > 0}
      <ul>
        {#each playlists as tag (tag)}
          {@render item({ kind: "playlist", tag }, tag, "playlist")}
        {/each}
      </ul>
    {:else}
      <p class="empty">Tag albums to make playlists.</p>
    {/if}
  </nav>
  <div class="add">
    <button class="aqua" title="Add to Library…" onclick={onadd}>+ Add to Library</button>
</div>
</div>

<style>
  .sources {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--source-bg);
    border-right: 1px solid #c6a9b6;
  }
  nav {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0;
  }
  .add {
    padding: 8px 10px;
  }
  .add button {
    width: 100%;
    padding-left: 0;
    padding-right: 0;
    text-align: center;
  }
  h3 {
    margin: 10px 0 2px 10px;
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    color: var(--source-heading);
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  nav button {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    border: none;
    background: none;
    padding: 2px 8px 2px 18px;
    text-align: left;
    color: #000;
    cursor: default;
  }
  nav button span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .icon {
    flex: none;
    fill: #8a6577;
  }
  .icon.recent {
    fill: #8d6fc4;
  }
  nav button.selected {
    background: var(--select-source-inactive);
    color: #fff;
    font-weight: bold;
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
  }
  nav:focus-within button.selected {
    background: var(--select-source);
  }
  nav button.selected .icon {
    fill: #fff;
  }
  .empty {
    margin: 2px 18px;
    color: var(--text-dim);
    font-style: italic;
  }
</style>
