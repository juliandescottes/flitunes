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
</script>

<header class="toolbar">
  <div class="actions">
    {#if spotifyStatus === "signed-in"}
      <div class="transport" role="group" aria-label="Playback">
        <button class="round" title="Previous" aria-label="Previous" onclick={onprevious}>
          <svg viewBox="0 0 16 12" width="15" height="11" aria-hidden="true"><path d="M8 0v12L2 6zM14 0v12L8 6z" fill="currentColor" /></svg>
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
            <svg viewBox="0 0 12 14" width="12" height="14" aria-hidden="true"><path d="M1 0l11 7-11 7z" fill="currentColor" /></svg>
          {/if}
        </button>
        <button class="round" title="Next" aria-label="Next" onclick={onnext}>
          <svg viewBox="0 0 16 12" width="15" height="11" aria-hidden="true"><path d="M2 0v12l6-6zM8 0v12l6-6z" fill="currentColor" /></svg>
        </button>
      </div>
    {/if}
  </div>

  <div class="lcd" aria-live="polite">
    {#if track && playback}
      <!-- Like iTunes, the display shows what's playing. -->
      <div class="lcd-title">{track.name}</div>
      <div class="lcd-sub">{track.artists.join(", ")} — {track.albumName}</div>
      <div class="lcd-progress" title={playback.deviceName ? `Playing on ${playback.deviceName}` : undefined}>
        <span>{formatTime(progress)}</span>
        <span class="bar"><span class="fill" style:width="{(progress / Math.max(1, track.durationMs)) * 100}%"></span></span>
        <span>-{formatTime(track.durationMs - progress)}</span>
      </div>
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
      <input type="search" placeholder="Search Library" bind:value={search} />
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
  /* Round, glossy transport buttons, like iTunes. */
  .round {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid #8f7783;
    border-radius: 50%;
    background: linear-gradient(#fffbfc, #e3cfd8);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
    color: #3d3036;
    cursor: default;
  }
  .round.big {
    width: 36px;
    height: 36px;
  }
  .round:active {
    background: linear-gradient(#ddc7d1, #f3e7ec);
  }
  .lcd {
    height: 40px;
    border: 1px solid #9b8590;
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
    border: 1px solid #7d6670;
    border-radius: 3px;
    background: #fffafb;
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    background: #7d6670;
  }
  .right {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
  }
  .segmented {
    display: flex;
    border: 1px solid #8f7783;
    border-radius: 4px;
    overflow: hidden;
  }
  /* The segmented buttons and the search field share one height. */
  .segmented button {
    border: none;
    height: 20px;
    padding: 0 9px;
    background: linear-gradient(#fffbfc, #e3cfd8);
    color: #444;
    display: grid;
    place-items: center;
  }
  .segmented button + button {
    border-left: 1px solid #8f7783;
  }
  .segmented button.on {
    background: linear-gradient(#a37a8c, #c7a3b3);
    color: #fff;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  .search {
    display: flex;
    align-items: center;
    gap: 4px;
    background: #fff;
    border: 1px solid #9b8590;
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
