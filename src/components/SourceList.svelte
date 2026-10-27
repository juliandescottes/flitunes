<script lang="ts">
  // iTunes 10 source list: LIBRARY and PLAYLISTS sections. Playlists are tags.
  // Triage (albums imported in bulk, waiting for review) shows while it has any.
  // The bottom holds the library actions (Add, Save, Export, Import), clear of
  // the window's rounded corner.
  import type { Source } from "../lib/browse.ts";
  import type { Theme } from "../lib/themes.ts";

  let {
    source = $bindable(),
    playlists,
    triageCount,
    onadd,
    unsavedChanges,
    canSaveToRepo,
    onsave,
    onsavemenu,
    ondownload,
    onimport,
    theme,
    ontheme,
  }: {
    source: Source;
    playlists: string[];
    triageCount: number;
    onadd: () => void;
    unsavedChanges: number;
    /** Save writes library.json (dev server, or a commit on the site); otherwise Export downloads it. */
    canSaveToRepo: boolean;
    onsave: () => void;
    /** Right-click on Save: the GitHub token's menu, on the site. */
    onsavemenu: (event: MouseEvent) => void;
    ondownload: () => void;
    onimport: () => void;
    theme: Theme;
    /** Opens the theme menu, above the given button. */
    ontheme: (button: HTMLElement) => void;
  } = $props();

  const isSelected = (s: Source) =>
    s.kind === source.kind && (s.kind !== "playlist" || (source.kind === "playlist" && s.tag === source.tag));
</script>

{#snippet item(s: Source, label: string, icon: "music" | "recent" | "triage" | "playlist", count?: number)}
  <li>
    <button class:selected={isSelected(s)} aria-current={isSelected(s)} onclick={() => (source = s)}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" class="icon {icon}">
        {#if icon === "music"}
          <path d="M6 3l7-1.5v9a2 2 0 1 1-1.5-1.9V4.4L7.5 5.3v7.2A2 2 0 1 1 6 10.6z" />
        {:else if icon === "recent"}
          <path d="M8 1.5l1.9 4 4.4.5-3.3 3 .9 4.4L8 11.2l-3.9 2.2.9-4.4-3.3-3 4.4-.5z" />
        {:else if icon === "triage"}
          <path d="M3 2h10l2 7v5H1V9zm.9 1.5L2.6 8.5H5.5l1 2h3l1-2h2.9l-1.3-5z" />
        {:else}
          <path d="M2 3h9v1.6H2zm0 3.5h9v1.6H2zm0 3.5h6v1.6H2zm9 0l4 2-4 2z" />
        {/if}
      </svg>
      <span>{label}</span>
      {#if count}<span class="count">{count}</span>{/if}
    </button>
  </li>
{/snippet}

<div class="sources">
  <nav aria-label="Sources">
    <h3>Library</h3>
    <ul>
      {@render item({ kind: "music" }, "Music", "music")}
      {@render item({ kind: "recent" }, "Recently Added", "recent")}
      {#if triageCount > 0 || source.kind === "triage"}
        {@render item({ kind: "triage" }, "Triage", "triage", triageCount)}
      {/if}
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
    <button class="aqua" title="Add albums to the library…" onclick={onadd}>+ Add Album(s)</button>
    <div class="file">
      {#if canSaveToRepo}
        <button
          class="aqua"
          class:default={unsavedChanges > 0}
          onclick={onsave}
          oncontextmenu={onsavemenu}
          disabled={unsavedChanges === 0}
          title="Save library.json (⌘S)">Save</button
        >
      {/if}
      <button class="aqua" onclick={ondownload} title="Download library.json">Export</button>
      <button class="aqua" onclick={onimport} title="Replace the library with a library.json file">Import</button>
      <button
        class="aqua swatch"
        title="Theme: {theme.name}"
        aria-label="Theme"
        aria-haspopup="menu"
        onclick={(e) => ontheme(e.currentTarget)}
      ><span style:--swatch-hue={theme.hue} style:--swatch-tint={theme.tint}></span></button>
    </div>
</div>
</div>

<style>
  .sources {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--source-bg);
    border-right: 1px solid oklch(76.4% calc(0.038 * var(--tint)) var(--hue));
  }
  nav {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0;
  }
  .add {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
  }
  .add button {
    padding-left: 0;
    padding-right: 0;
    text-align: center;
  }
  .file {
    display: flex;
    gap: 4px;
  }
  .file button {
    flex: 1;
    min-width: 0;
  }
  .file .swatch {
    flex: none;
    width: 22px;
    display: grid;
    place-items: center;
  }
  /* The theme's selection color. */
  .swatch span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.3);
    background: oklch(61.5% calc(0.19 * var(--swatch-tint)) var(--swatch-hue));
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
    fill: oklch(55.0% calc(0.054 * var(--tint)) var(--hue));
  }
  .icon.recent {
    fill: #8d6fc4;
  }
  .icon.triage {
    fill: oklch(61.2% calc(0.127 * var(--tint)) var(--hue));
  }
  /* iTunes 10's count badge, as on Podcasts. */
  .count {
    margin-left: auto;
    flex: none;
    padding: 0 6px;
    border-radius: 8px;
    background: oklch(64.3% calc(0.034 * var(--tint)) var(--hue));
    color: #fff;
    font-size: 10px;
    font-weight: bold;
    line-height: 14px;
    text-shadow: none;
  }
  nav button.selected .count {
    background: #fff;
    color: var(--select);
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
