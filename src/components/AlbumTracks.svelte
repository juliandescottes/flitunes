<script lang="ts">
  // Album details: the cover, the album's info and its tracks, fetched from
  // Spotify (never saved). Double-click or Enter on a track plays the album
  // from that track; the playing track is marked. Like iTunes 10's song list,
  // each row repeats the album, genre and year, from the curated album
  // (Spotify's year when it has none).
  import { formatTime } from "../lib/spotify-player.svelte.ts";
  import type { Album } from "../lib/model.ts";
  import { coverSrc } from "../lib/persistence.ts";
  import { trackArtists, type Track } from "../lib/spotify-tracks.ts";

  let {
    album,
    genre,
    load,
    loadYear,
    playingUri,
    isPlaying,
    onplay,
    onback,
  }: {
    album: Album;
    /** The album's primary genre name. */
    genre: string | null;
    /** Fetches the tracks (cached by the caller). */
    load: () => Promise<Track[]>;
    /** Spotify's release year, used when the album has no year. */
    loadYear: () => Promise<number | null>;
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

  let spotifyYear = $state<number | null>(null);
  $effect(() => {
    const albumId = album.id;
    spotifyYear = null;
    if (album.year !== null) return;
    loadYear().then((y) => {
      if (album.id === albumId) spotifyYear = y;
    });
  });
  const year = $derived(album.year ?? spotifyYear);

  const discs = $derived(new Set(tracks?.map((t) => t.disc)).size > 1);
  const totalMs = $derived(tracks?.reduce((sum, t) => sum + t.durationMs, 0) ?? 0);

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
      {#if album.cover}<img src={coverSrc(album.cover)} alt="" />{:else}<div class="blank" aria-hidden="true">♫</div>{/if}
      <!-- Shown over the cover while hovering it, like the grid. -->
      <button class="play" title="Play" aria-label="Play {album.title}" onclick={() => onplay()}>
        <svg viewBox="0 0 12 14" width="16" height="18" aria-hidden="true"><path d="M2 0l10 7-10 7z" fill="currentColor" /></svg>
      </button>
    </div>
    <div class="info">
      <h2>{album.title}</h2>
      <div class="artist">{album.artists.join(", ")}</div>
      <div class="meta">
        {[year, tracks && `${tracks.length} ${tracks.length === 1 ? "song" : "songs"}`, tracks && formatTime(totalMs)]
          .filter(Boolean)
          .join(" · ")}
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
          <col class="state" />
          <col class="num" />
          <col />
          <col class="time" />
          <col class="artist" />
          <col class="album" />
          <col class="genre" />
          <col class="year" />
        </colgroup>
        <thead>
          <tr>
            <th class="state"></th>
            <th class="num">#</th>
            <th>Name</th>
            <th class="time">Time</th>
            <th>Artist</th>
            <th class="album">Album</th>
            <th class="genre">Genre</th>
            <th class="year">Year</th>
          </tr>
        </thead>
        <tbody>
          {#each tracks as track, i (track.uri + i)}
            {@const playing = track.uri === playingUri}
            {#if discs && (i === 0 || tracks[i - 1].disc !== track.disc)}
              <tr class="disc"><td colspan="8">Disc {track.disc}</td></tr>
            {/if}
            <tr
              class:selected={i === selected}
              class:playing
              aria-selected={i === selected}
              onmousedown={() => (selected = i)}
              ondblclick={() => onplay(track.uri)}
            >
              <td class="state">
                {#if playing}
                  <!-- Like iTunes: a speaker left of the number, with sound waves while playing. -->
                  <svg class="speaker" viewBox="0 0 13 10" width="13" height="10" role="img" aria-label={isPlaying ? "Playing" : "Paused"}>
                    <path d="M0 3.3h2.6L6 .6v8.8L2.6 6.7H0z" fill="currentColor" />
                    {#if isPlaying}
                      <path d="M8 3.2a2.4 2.4 0 0 1 0 3.6M10 1.4a5 5 0 0 1 0 7.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
                    {/if}
                  </svg>
                {/if}
              </td>
              <td class="num">{track.number}</td>
              <td class="name">{track.name}</td>
              <td class="time">{formatTime(track.durationMs)}</td>
              <td>{trackArtists(track, album.artists).join(", ")}</td>
              <td class="album">{album.title}</td>
              <td class="genre">{genre ?? ""}</td>
              <td class="year">{year ?? ""}</td>
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
    position: relative;
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
  .play {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 44px;
    height: 44px;
    margin: -22px 0 0 -22px;
    padding: 0 0 0 3px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    opacity: 0;
    transition: opacity 0.15s;
    cursor: default;
  }
  .cover:hover .play,
  .play:focus-visible {
    opacity: 1;
  }
  .play:hover {
    background: rgba(0, 0, 0, 0.6);
  }
  .play:active {
    background: rgba(0, 0, 0, 0.75);
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
  col.state {
    width: 20px;
  }
  col.num {
    width: 30px;
  }
  col.time {
    width: 52px;
  }
  col.artist {
    width: 20%;
  }
  col.album {
    width: 20%;
  }
  col.genre {
    width: 12%;
  }
  col.year {
    width: 48px;
  }
  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    height: 18px;
    padding: 0 6px;
    background: var(--header);
    box-shadow: inset 0 -1px 0 var(--header-border);
    border-right: 1px solid #c8c8c8;
    font-weight: normal;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  th.num,
  th.time,
  td.num,
  td.time {
    text-align: right;
  }
  td.num {
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
  td.state {
    padding: 0 0 0 6px;
  }
  .speaker {
    display: block;
    color: var(--select);
  }
  .tracks:focus tr.selected .speaker {
    color: #fff;
  }
  /* Narrow: the album, genre and year are in the header already. */
  @media (max-width: 640px) {
    col.album,
    col.genre,
    col.year,
    .album,
    .genre,
    .year {
      display: none;
    }
  }
  /* Short: a smaller header leaves more room for the tracks. */
  @media (max-height: 640px) {
    header {
      padding: 10px 16px;
    }
    .cover {
      width: 80px;
      height: 80px;
    }
  }
  .empty {
    margin: 24px;
    color: var(--text-dim);
    text-align: center;
  }
</style>
