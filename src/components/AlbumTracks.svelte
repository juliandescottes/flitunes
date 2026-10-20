<script lang="ts">
  // Album details: the cover, the album's info and its tracks, fetched from
  // Spotify (never saved). Double-click or Enter on a track plays the album
  // from that track; the playing track is marked.
  import { formatTime } from "../lib/spotify-player.svelte.ts";
  import type { Album } from "../lib/model.ts";
  import type { Track } from "../lib/spotify-tracks.ts";

  let {
    album,
    load,
    playingUri,
    isPlaying,
    onplay,
    onback,
  }: {
    album: Album;
    /** Fetches the tracks (cached by the caller). */
    load: () => Promise<Track[]>;
    /** The track playing (or paused) in Spotify. */
    playingUri: string | null;
    isPlaying: boolean;
    /** Plays the album, from a track if given. */
    onplay: (trackUri?: string) => void;
    onback: () => void;
  } = $props();

  let tracks = $state.raw<Track[] | null>(null);
  let error = $state<string | null>(null);
  let selected = $state(-1);
  let list: HTMLDivElement;

  $effect(() => {
    const albumId = album.id;
    tracks = null;
    error = null;
    selected = -1;
    load().then(
      (t) => {
        if (album.id === albumId) tracks = t;
      },
      (e) => {
        if (album.id === albumId) error = (e as Error).message;
      },
    );
  });

  const discs = $derived(new Set(tracks?.map((t) => t.disc)).size > 1);
  const totalMs = $derived(tracks?.reduce((sum, t) => sum + t.durationMs, 0) ?? 0);
  const albumArtists = $derived(new Set(album.artists));

  function onkeydown(event: KeyboardEvent) {
    if (!tracks?.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      selected = Math.max(0, Math.min(tracks.length - 1, selected + (event.key === "ArrowDown" ? 1 : -1)));
      list.querySelectorAll("tbody tr")[selected]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && selected >= 0) {
      onplay(tracks[selected].uri);
    } else if (event.key === "Escape") {
      onback();
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }
</script>

<div class="details">
  <header>
    <div class="cover">
      {#if album.cover}<img src={album.cover} alt="" />{:else}<div class="blank" aria-hidden="true">♫</div>{/if}
    </div>
    <div class="info">
      <h2>{album.title}</h2>
      <div class="artist">{album.artists.join(", ")}</div>
      <div class="meta">
        {[album.year, tracks && `${tracks.length} ${tracks.length === 1 ? "song" : "songs"}`, tracks && formatTime(totalMs)]
          .filter(Boolean)
          .join(" · ")}
      </div>
      <div class="buttons">
        <button class="aqua default" onclick={() => onplay()} disabled={!tracks?.length}>▶ Play</button>
        <button class="aqua" onclick={onback} title="Back to the library (Esc)">Back</button>
      </div>
    </div>
  </header>

  <div
    class="tracks"
    bind:this={list}
    tabindex="0"
    role="grid"
    aria-label="Tracks of {album.title}"
    {onkeydown}
  >
    {#if error}
      <p class="empty">Couldn't load the tracks: {error}</p>
    {:else if !tracks}
      <p class="empty">Loading tracks…</p>
    {:else if tracks.length === 0}
      <p class="empty">Spotify lists no tracks for this album.</p>
    {:else}
      <table>
        <!-- Widths here: with a fixed layout, the first row (maybe a disc row) would set them. -->
        <colgroup>
          <col class="num" />
          <col />
          <col class="artist" />
          <col class="time" />
        </colgroup>
        <tbody>
          {#each tracks as track, i (track.uri + i)}
            {@const playing = track.uri === playingUri}
            {#if discs && (i === 0 || tracks[i - 1].disc !== track.disc)}
              <tr class="disc"><td colspan="4">Disc {track.disc}</td></tr>
            {/if}
            <tr
              class:selected={i === selected}
              class:playing
              aria-selected={i === selected}
              onmousedown={() => (selected = i)}
              ondblclick={() => onplay(track.uri)}
            >
              <td class="num">
                {#if playing}<span class="speaker" title={isPlaying ? "Playing" : "Paused"}>{isPlaying ? "🔊" : "🔈"}</span>{:else}{track.number}{/if}
              </td>
              <td class="name">{track.name}</td>
              <td class="artist">
                {track.artists.some((a) => !albumArtists.has(a)) ? track.artists.join(", ") : ""}
              </td>
              <td class="time">{formatTime(track.durationMs)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

<style>
  .details {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #fff;
    user-select: none;
  }
  header {
    display: flex;
    gap: 16px;
    padding: 16px;
    border-bottom: 1px solid var(--rule);
  }
  .cover {
    flex: none;
    width: 140px;
    height: 140px;
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
  .info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  h2 {
    margin: 0;
    font-size: 18px;
  }
  .artist {
    font-size: 13px;
  }
  .meta {
    color: var(--text-dim);
  }
  .buttons {
    margin-top: auto;
    display: flex;
    gap: 6px;
  }
  .tracks {
    flex: 1;
    overflow: auto;
    outline: none;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  td {
    height: 18px;
    padding: 0 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: default;
  }
  tbody tr:nth-child(even) td {
    background: var(--stripe);
  }
  col.num {
    width: 36px;
  }
  col.artist {
    width: 30%;
  }
  col.time {
    width: 56px;
  }
  td.num,
  td.time {
    text-align: right;
    color: var(--text-dim);
  }
  td.artist {
    font-size: inherit;
    color: var(--text-dim);
  }
  tr.playing .name {
    font-weight: bold;
  }
  tr.disc td {
    background: #fff !important;
    font-weight: bold;
    padding-top: 6px;
  }
  tr.selected td {
    background: var(--select-inactive) !important;
  }
  .tracks:focus tr.selected td {
    background: var(--select) !important;
    color: #fff;
  }
  .speaker {
    font-size: 10px;
  }
  .empty {
    margin: 24px;
    color: var(--text-dim);
    text-align: center;
  }
</style>
