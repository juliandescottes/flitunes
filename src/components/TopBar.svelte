<script lang="ts">
  // iTunes 10 toolbar: library actions on the left (where the playback
  // controls were), the LCD display in the middle, view switcher and search
  // on the right.
  import type { ViewMode } from "../lib/browse.ts";
  import type { Album } from "../lib/model.ts";
  import { currentProgress, formatTime, type Playback } from "../lib/spotify-player.svelte.ts";
  import type { SpotifyStatus } from "../lib/spotify-session.svelte.ts";

  let {
    album,
    selectedCount,
    unsavedChanges,
    spotifyStatus,
    spotifyUser,
    onspotify,
    playback,
    ontoggleplay,
    onnext,
    onprevious,
    ondevices,
    playingAlbum,
    playingShown,
    onshowplaying,
    view = $bindable(),
    linkedOnly = $bindable(),
    search = $bindable(),
  }: {
    /** The selected album when exactly one is selected. */
    album: Album | null;
    selectedCount: number;
    unsavedChanges: number;
    spotifyStatus: SpotifyStatus;
    /** Display name of the signed-in Spotify account. */
    spotifyUser: string | null;
    /** Signs in to Spotify, or out when signed in. */
    onspotify: () => void;
    /** What Spotify is playing, while signed in. */
    playback: Playback | null;
    ontoggleplay: () => void;
    onnext: () => void;
    onprevious: () => void;
    /** Opens the menu of devices to play on, below the given button. */
    ondevices: (button: HTMLElement) => void;
    /** The library album of the playing track, if it's in the library. */
    playingAlbum: Album | null;
    /** The playing album's tracks are what the main view shows. */
    playingShown: boolean;
    /** Shows the playing album's tracks. */
    onshowplaying: () => void;
    view: ViewMode;
    /** Hide albums without a Spotify link. */
    linkedOnly: boolean;
    search: string;
  } = $props();

  // A clock for the progress bar, ticking only while something plays.
  let now = $state(Date.now());
  $effect(() => {
    if (!playback?.isPlaying) return;
    now = Date.now();
    const timer = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(timer);
  });
  const track = $derived(playback?.track ?? null);
  const progress = $derived(playback && track ? currentProgress(playback, now) : 0);

  let searchInput: HTMLInputElement;

  function clearSearch() {
    search = "";
    searchInput.focus();
  }
</script>

<header class="toolbar">
  <div class="actions">
    {#if spotifyStatus === "signed-in"}
      <div class="transport" role="group" aria-label="Playback">
        <button class="round" title="Previous" aria-label="Previous" onclick={onprevious}>
          <svg viewBox="0 0 16 12" width="16" height="12" aria-hidden="true"><path d="M7 0v12L1 6zM13 0v12L7 6z" fill="currentColor" /></svg>
        </button>
        <button
          class="round big"
          title={playback?.isPlaying ? "Pause" : "Play"}
          aria-label={playback?.isPlaying ? "Pause" : "Play"}
          onclick={ontoggleplay}
        >
          {#if playback?.isPlaying}
            <svg viewBox="0 0 12 14" width="12" height="14" aria-hidden="true"><path d="M1 0h4v14H1zM7 0h4v14H7z" fill="currentColor" /></svg>
          {:else}
            <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M3 0l11 7-11 7z" fill="currentColor" /></svg>
          {/if}
        </button>
        <button class="round" title="Next" aria-label="Next" onclick={onnext}>
          <svg viewBox="0 0 16 12" width="16" height="12" aria-hidden="true"><path d="M3 0v12l6-6zM9 0v12l6-6z" fill="currentColor" /></svg>
        </button>
        <!-- Like iTunes' AirPlay menu: where to play. -->
        <button
          class="round small"
          title={playback?.deviceName ? `Playing on ${playback.deviceName}. Click to choose a device.` : "Choose a device to play on"}
          aria-label="Devices"
          aria-haspopup="menu"
          onclick={(e) => ondevices(e.currentTarget)}
        >
          <!-- A screen on its stand. -->
          <svg viewBox="0 0 14 12" width="14" height="12" aria-hidden="true">
            <rect x="1" y="0.7" width="12" height="7.6" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" />
            <path d="M7 9v2M4.5 11.3h5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    {/if}
  </div>

  <div class="lcd" class:with-disc={track && playback} aria-live="polite">
    {#if track && playback}
      <!-- Like iTunes, the display shows what's playing. -->
      <div class="lcd-title">{track.name}</div>
      <div class="lcd-sub">{track.artists.join(", ")} — {track.albumName}</div>
      <div class="lcd-progress" title={playback.deviceName ? `Playing on ${playback.deviceName}` : undefined}>
        <span>{formatTime(progress)}</span>
        <span class="bar"><span class="fill" style:width="{(progress / Math.max(1, track.durationMs)) * 100}%"></span></span>
        <span>-{formatTime(track.durationMs - progress)}</span>
      </div>
      <!-- Always there while a track plays (dimmed when it can't be used), so the display doesn't shift. -->
      <button
        class="show-playing"
        disabled={!playingAlbum || playingShown}
        title={!playingAlbum ? "This album isn't in your library" : playingShown ? "Showing this album's tracks" : "Show the album's tracks"}
        aria-label="Show the playing album's tracks"
        onclick={onshowplaying}
      >
        <svg viewBox="0 0 14 14" width="16" height="16" aria-hidden="true">
          <path
            d="M7 .5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm0 4.6a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8z"
            fill="currentColor"
            fill-rule="evenodd"
          />
          <path d="M7 2.4a4.6 4.6 0 0 1 4.6 4.6" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="0.9" />
        </svg>
      </button>
    {:else if album}
      <div class="lcd-title">{album.title}</div>
      <div class="lcd-sub">{album.artists.join(", ")}{album.year ? ` — ${album.year}` : ""}</div>
    {:else if selectedCount > 1}
      <div class="lcd-title">{selectedCount} albums selected</div>
      <div class="lcd-sub">⌘I to edit them together</div>
    {:else}
      <div class="lcd-title">FliTunes</div>
      <div class="lcd-sub">
        {unsavedChanges === 0 ? "All changes saved" : `${unsavedChanges} unsaved change${unsavedChanges === 1 ? "" : "s"}`}
      </div>
    {/if}
  </div>

  <div class="right">
    {#if spotifyStatus !== "disabled"}
      <div class="segmented">
        <button
          class:on={spotifyStatus === "signed-in"}
          aria-pressed={spotifyStatus === "signed-in"}
          aria-label="Connected to Spotify"
          disabled={spotifyStatus === "signing-in"}
          title={spotifyStatus === "signed-in"
            ? `Connected to Spotify${spotifyUser ? ` as ${spotifyUser}` : ""}. Click to disconnect.`
            : "Connect to Spotify, to control playback from here"}
          onclick={onspotify}
        >
          <!-- Sound waves: generic, not Spotify's logo. -->
          <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true">
            <path
              d="M2.5 4.6c3-1 6.2-.8 9 .6M3 7.4c2.5-.8 5-.6 7.3.5M3.6 10c1.9-.5 3.7-.4 5.4.4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    {/if}
    <div class="segmented">
      <button
        class:on={linkedOnly}
        aria-pressed={linkedOnly}
        aria-label="Only albums with a Spotify link"
        title={linkedOnly ? "Show albums without a Spotify link" : "Hide albums without a Spotify link"}
        onclick={() => (linkedOnly = !linkedOnly)}
      >
        <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true">
        <path
          d="M6 8a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-1 1M8 6a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l1-1"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
      </button>
    </div>
    <div class="segmented" role="group" aria-label="View">
      <button class:on={view === "list"} aria-pressed={view === "list"} title="List" onclick={() => (view = "list")}>
        <svg viewBox="0 0 14 10" width="14" height="10" aria-hidden="true">
          <path d="M0 1h14M0 5h14M0 9h14" stroke="currentColor" stroke-width="1.6" />
        </svg>
      </button>
      <button class:on={view === "albums"} aria-pressed={view === "albums"} title="Album List" onclick={() => (view = "albums")}>
        <svg viewBox="0 0 14 10" width="14" height="10" aria-hidden="true">
          <path d="M0 0h4v4H0zM0 6h4v4H0z" fill="currentColor" />
          <path d="M6 1h8M6 3h8M6 7h8M6 9h8" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </button>
      <button class:on={view === "grid"} aria-pressed={view === "grid"} title="Grid" onclick={() => (view = "grid")}>
        <svg viewBox="0 0 14 10" width="14" height="10" aria-hidden="true">
          <path d="M0 0h4v4H0zM5 0h4v4H5zM10 0h4v4h-4zM0 6h4v4H0zM5 6h4v4H5zM10 6h4v4h-4z" fill="currentColor" />
        </svg>
      </button>
    </div>
    <label class="search">
      <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
        <circle cx="5" cy="5" r="3.8" fill="none" stroke="#666" stroke-width="1.5" />
        <path d="M8 8l3.2 3.2" stroke="#666" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      <input
        type="search"
        placeholder="Search Library"
        bind:this={searchInput}
        bind:value={search}
        onkeydown={(e) => e.key === "Escape" && search !== "" && clearSearch()}
      />
      {#if search !== ""}
        <!-- Like the Mac's search fields: a round grey clear button. -->
        <button class="clear" title="Clear the search (Esc)" aria-label="Clear the search" onclick={clearSearch}>
          <svg viewBox="0 0 8 8" width="6" height="6" aria-hidden="true">
            <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
      {/if}
    </label>
  </div>
</header>

<style>
  .toolbar {
    display: grid;
    grid-template-columns: 1fr minmax(240px, 420px) 1fr;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    padding-top: calc(8px + env(safe-area-inset-top, 0px));
    background: var(--toolbar);
    border-bottom: 1px solid var(--toolbar-border);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .transport {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-right: 8px;
  }
  /* Round, glossy transport buttons, like iTunes. Each icon's width and
     height have the same parity as its button's inner size (30px buttons:
     even icons; the 24px screen button: even too), so it centers on whole
     pixels. Triangles sit 1px off center towards their points: their weight
     is on their flat side, so a centered box looks off center. */
  .round {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid oklch(59.6% calc(0.034 * var(--tint)) var(--hue));
    border-radius: 50%;
    background: linear-gradient(oklch(99.1% calc(0.004 * var(--tint)) var(--hue)), oklch(87.3% calc(0.025 * var(--tint)) var(--hue)));
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
    color: oklch(32.6% calc(0.021 * var(--tint)) var(--hue));
    cursor: default;
  }
  .round.big {
    width: 36px;
    height: 36px;
  }
  .round.small {
    width: 24px;
    height: 24px;
    margin-left: 4px;
  }
  .round:active {
    background: linear-gradient(oklch(85.1% calc(0.028 * var(--tint)) var(--hue)), oklch(93.9% calc(0.015 * var(--tint)) var(--hue)));
  }
  .lcd {
    height: 40px;
    border: 1px solid oklch(64.0% calc(0.031 * var(--tint)) var(--hue));
    border-radius: 5px;
    background: var(--lcd);
    box-shadow:
      inset 0 1px 2px rgba(0, 0, 0, 0.25),
      0 1px 0 rgba(255, 255, 255, 0.6);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    overflow: hidden;
    padding: 0 12px;
    user-select: none;
  }
  .lcd {
    position: relative;
  }
  /* Room for the disc, on both sides so the text stays centered. */
  .lcd.with-disc {
    padding: 0 34px;
  }
  /* A disc at the display's right edge: shows the playing album's tracks. */
  .show-playing {
    position: absolute;
    right: 8px;
    top: 50%;
    margin-top: -10px;
    width: 20px;
    height: 20px;
    padding: 0;
    display: grid;
    place-items: center;
    border: none;
    background: none;
    color: oklch(53.6% calc(0.033 * var(--tint)) var(--hue));
    cursor: default;
  }
  .show-playing:hover:not(:disabled) {
    color: var(--select);
  }
  .show-playing:disabled {
    opacity: 0.35;
  }
  .lcd > div {
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lcd-title {
    font-weight: bold;
  }
  .lcd-sub {
    color: #444;
  }
  .lcd-progress {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 70%;
    font-size: 9px;
    color: #444;
  }
  .bar {
    flex: 1;
    height: 5px;
    border: 1px solid oklch(53.6% calc(0.033 * var(--tint)) var(--hue));
    border-radius: 3px;
    background: oklch(98.9% calc(0.005 * var(--tint)) var(--hue));
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    background: oklch(53.6% calc(0.033 * var(--tint)) var(--hue));
  }
  .right {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
  }
  .segmented {
    display: flex;
    border: 1px solid oklch(59.6% calc(0.034 * var(--tint)) var(--hue));
    border-radius: 4px;
    overflow: hidden;
  }
  /* The segmented buttons and the search field share one height. */
  .segmented button {
    border: none;
    height: 20px;
    padding: 0 9px;
    background: linear-gradient(oklch(99.1% calc(0.004 * var(--tint)) var(--hue)), oklch(87.3% calc(0.025 * var(--tint)) var(--hue)));
    color: #444;
    display: grid;
    place-items: center;
  }
  .segmented button + button {
    border-left: 1px solid oklch(59.6% calc(0.034 * var(--tint)) var(--hue));
  }
  .segmented button.on {
    background: linear-gradient(oklch(62.5% calc(0.057 * var(--tint)) var(--hue)), oklch(75.3% calc(0.047 * var(--tint)) var(--hue)));
    color: #fff;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  .search {
    display: flex;
    align-items: center;
    gap: 4px;
    background: #fff;
    border: 1px solid oklch(64.0% calc(0.031 * var(--tint)) var(--hue));
    border-radius: 11px;
    box-sizing: border-box;
    height: 22px;
    padding: 0 8px;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
    width: 160px;
  }
  .search input {
    border: none;
    outline: none;
    font: inherit;
    width: 100%;
    background: transparent;
  }
  /* The browser's own clear button, replaced by .clear. */
  .search input::-webkit-search-cancel-button {
    appearance: none;
  }
  .clear {
    flex: none;
    display: grid;
    place-items: center;
    width: 13px;
    height: 13px;
    margin-right: -4px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: oklch(71.4% calc(0.011 * var(--tint)) var(--hue));
    color: #fff;
    cursor: default;
  }
  .clear:hover {
    background: oklch(61.5% calc(0.011 * var(--tint)) var(--hue));
  }
  .clear:active {
    background: oklch(52.5% calc(0.010 * var(--tint)) var(--hue));
  }
  @media (max-width: 700px) {
    .toolbar {
      grid-template-columns: 1fr;
    }
    .actions,
    .right {
      justify-content: center;
    }
  }
</style>
