import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvAlbums } from "../../src/lib/csv.ts";
import type { Album } from "../../src/lib/model.ts";
import {
  aggregate,
  albumListens,
  albumRows,
  pairKey,
  parseAlbumPage,
  parseMetas,
  toCsv,
  trackAlbumId,
  triageAlbums,
  type Pair,
  type Play,
  type Resolved,
  type SpotifyAlbum,
} from "./lib.ts";

const TRACK_A = "4dbjQnqxzXNtcD7ldQ7RuQ";
const TRACK_B = "64im41NhRSHBEYKJQP2LrA";
const TRACK_C = "5YJb1FwGquJbAgf7CcSn7s";
const ALBUM_1 = "1JZHc4kOkTOM50MqPn91iX";
const ALBUM_2 = "4dZzebB3bTIXLJpTMOSE44";

const play = (track: string | null, ts: string, extra: Partial<Play> = {}): Play => ({
  ts,
  ms_played: 200_000,
  master_metadata_album_artist_name: "Nujabes",
  master_metadata_album_album_name: "Modal Soul",
  spotify_track_uri: track && `spotify:track:${track}`,
  ...extra,
});

describe("aggregate", () => {
  it("counts listens of 30 s or more per album, with distinct tracks, dates and the most played track", () => {
    const [pair, ...rest] = aggregate([
      play(TRACK_A, "2015-03-02T10:00:00Z"),
      play(TRACK_B, "2014-01-01T10:00:00Z"),
      play(TRACK_B, "2020-12-31T10:00:00Z"),
      play(TRACK_C, "2021-01-01T10:00:00Z", { ms_played: 29_999 }), // skipped: too short
      play(null, "2021-01-01T10:00:00Z"), // a podcast
    ]);
    expect(rest).toEqual([]);
    expect(pair).toEqual({
      artist: "Nujabes",
      album: "Modal Soul",
      plays: 3,
      tracks_played: 2,
      first_played: "2014-01-01",
      last_played: "2020-12-31",
      sample_track: TRACK_B,
    });
  });

  it("keeps pairs with enough listens over enough tracks, most played first", () => {
    const pair = (album: string, plays: number, tracks: number) =>
      ({ artist: "A", album, plays, tracks_played: tracks, first_played: "", last_played: "", sample_track: TRACK_A }) as Pair;
    const result = albumListens([pair("one song", 50, 1), pair("few", 5, 5), pair("small", 10, 3), pair("big", 40, 9)], 10, 3);
    expect(result.kept.map((p) => p.album)).toEqual(["big", "small"]);
    expect(result).toMatchObject({ fewPlays: 1, fewTracks: 1 });
  });
});

describe("Spotify pages", () => {
  const albumPage = `<html><head>
    <meta property="og:title" content="Listen to Love &amp; Light - Remix - Album by Dawn &#x27;n&#x27; Dusk · Duo | Spotify"/>
    <meta property="og:description" content="Dawn &#x27;n&#x27; Dusk · Duo · compilation · 2009 · 16 songs"/>
    <meta property="og:image" content="https://i.scdn.co/image/ab67616d0000b2731ed696411749957838a058e9"/>
    <meta property="og:image" content="https://i.scdn.co/image/second"/>
    <meta name="music:release_date" content="2009-01-01"/>
  </head></html>`;

  it("reads an album page, splitting the description from the right", () => {
    expect(parseAlbumPage(parseMetas(albumPage))).toEqual({
      title: "Love & Light - Remix",
      artist: "Dawn 'n' Dusk · Duo",
      type: "compilation",
      year: "2009",
      total_tracks: 16,
      release_date: "2009-01-01",
      cover: "https://i.scdn.co/image/ab67616d0000b2731ed696411749957838a058e9",
    });
  });

  it("leaves the title to the export when og:title doesn't parse, and rejects odd descriptions", () => {
    const metas = parseMetas(`<meta property="og:title" content="Spotify"/><meta property="og:description" content="A · single · 2001 · 1 song"/>`);
    expect(parseAlbumPage(metas)).toMatchObject({ title: null, artist: "A", type: "single", total_tracks: 1 });
    expect(() => parseAlbumPage(parseMetas(`<meta property="og:description" content="Web Player"/>`))).toThrow();
  });

  it("finds a track's album", () => {
    expect(trackAlbumId(parseMetas(`<meta name="music:album" content="https://open.spotify.com/album/${ALBUM_1}"/>`))).toBe(ALBUM_1);
    expect(trackAlbumId(parseMetas(`<meta property="og:title" content="A song"/>`))).toBeNull();
  });
});

const spotifyAlbum = (patch: Partial<SpotifyAlbum> = {}): SpotifyAlbum => ({
  title: "Modal Soul",
  artist: "Nujabes",
  type: "album",
  year: "2005",
  total_tracks: 14,
  release_date: "2005-11-11",
  cover: "https://i.scdn.co/image/x",
  ...patch,
});

const libraryAlbum = (title: string, artist: string, spotify: string | null = null): Album => ({
  id: title,
  title,
  artists: [artist],
  artistSort: null,
  year: null,
  genres: [],
  tags: [],
  rating: null,
  notes: "",
  spotify,
  cover: null,
  addedAt: "2026-01-01T00:00:00Z",
});

describe("albumRows", () => {
  const pair = (artist: string, album: string, plays: number, first: string, last: string): Pair => ({
    artist,
    album,
    plays,
    tracks_played: plays % 7,
    first_played: first,
    last_played: last,
    sample_track: TRACK_A,
  });
  const ok = (p: Pair, id: string, album: SpotifyAlbum): [string, Resolved] => [
    pairKey(p),
    { ...p, status: "ok", album_id: id, spotify_album: album },
  ];

  it("merges pairs resolving to one album, cleans the title, and names compilations Various Artists", () => {
    const a = pair("Nujabes", "Modal Soul", 30, "2015-01-01", "2016-01-01");
    const b = pair("Nujabes", "Modal Soul (Deluxe)", 20, "2014-01-01", "2015-06-01");
    const c = pair("The Smiths", "The Sound of the Smiths", 12, "2010-01-01", "2011-01-01");
    const resolved = new Map([
      ok(a, ALBUM_1, spotifyAlbum({ title: "Modal Soul (Remastered 2015)" })),
      ok(b, ALBUM_1, spotifyAlbum({ title: "Modal Soul (Remastered 2015)" })),
      ok(c, ALBUM_2, spotifyAlbum({ title: "The Sound of the Smiths", artist: "The Smiths", type: "compilation" })),
    ]);
    const { rows, albums, mergedAlbums } = albumRows([a, b, c], resolved, []);
    expect({ albums, mergedAlbums }).toEqual({ albums: 2, mergedAlbums: 1 });
    expect(rows[0]).toMatchObject({
      artist: "Nujabes",
      album: "Modal Soul",
      plays: "50",
      tracks_played: "6",
      first_played: "2014-01-01",
      last_played: "2016-01-01",
      spotify: `https://open.spotify.com/album/${ALBUM_1}`,
    });
    expect(rows[1]).toMatchObject({ artist: "Various Artists", spotify_artist: "The Smiths", type: "compilation" });
  });

  it("skips albums already in the library, by link or by artist and title", () => {
    const a = pair("Nujabes", "Modal Soul", 30, "2015-01-01", "2016-01-01");
    const b = pair("Kaneko Ayano", "燦々", 20, "2019-01-01", "2020-01-01");
    const c = pair("Kaneko Ayano", "祝祭", 10, "2019-01-01", "2020-01-01");
    const resolved = new Map([
      ok(a, ALBUM_1, spotifyAlbum()),
      ok(b, ALBUM_2, spotifyAlbum({ title: "燦々", artist: "Kaneko Ayano" })),
      ok(c, "0".repeat(22), spotifyAlbum({ title: "祝祭", artist: "Kaneko Ayano" })),
    ]);
    const library = [libraryAlbum("Modal Soul", "Nujabes", `spotify:album:${ALBUM_1}`), libraryAlbum("燦々", "Kaneko Ayano")];
    const result = albumRows([a, b, c], resolved, library);
    expect(result).toMatchObject({ byLink: 1, byKey: 1 });
    expect(result.rows.map((r) => r.album)).toEqual(["祝祭"]);
  });

  it("writes a CSV the app reads back", () => {
    const a = pair("Godspeed, Inc.", 'The "Best" Of', 30, "2015-01-01", "2016-01-01");
    const resolved = new Map([ok(a, ALBUM_1, spotifyAlbum({ title: 'The "Best" Of', artist: "Godspeed, Inc." }))]);
    const csv = toCsv(albumRows([a], resolved, []).rows);
    expect(parseCsvAlbums(csv)).toEqual([
      { title: 'The "Best" Of', artist: "Godspeed, Inc.", year: 2005, plays: 30, spotify: `https://open.spotify.com/album/${ALBUM_1}` },
    ]);
  });
});

describe("triageAlbums", () => {
  const row = (artist: string, album: string, plays: number, id: string, extra: Record<string, string> = {}) => ({
    artist,
    album,
    year: "2014",
    plays: String(plays),
    spotify: `https://open.spotify.com/album/${id}`,
    cover: "https://i.scdn.co/image/x",
    type: "album",
    tracks_played: "9",
    total_tracks: "12",
    first_played: "2014-09-30",
    last_played: "2025-12-03",
    spotify_artist: artist,
    ...extra,
  });
  let n = 0;
  const newId = () => `new${n++}`;
  const NOW = Date.parse("2026-10-21T15:00:00Z");

  it("tags new albums for triage, with stats in the notes and dates in play order", () => {
    const rows = [row("Islands", "Taste", 50, "A".repeat(22)), row("Austin Wintory", "The Banner Saga", 3692, "B".repeat(22))];
    const { added } = triageAlbums(rows, [], { newId, now: NOW });
    expect(added.map((a) => [a.title, a.addedAt])).toEqual([
      ["The Banner Saga", "2026-10-21T15:00:00.000Z"],
      ["Taste", "2026-10-21T14:59:59.000Z"],
    ]);
    expect(added[0]).toMatchObject({
      artists: ["Austin Wintory"],
      year: 2014,
      tags: ["triage"],
      spotify: `spotify:album:${"B".repeat(22)}`,
      notes: "Spotify history: 3,692 plays, 9/12 tracks, 2014-09-30 to 2025-12-03.",
    });
  });

  it("skips the library, dropped artists and other editions, but keeps same-named compilations apart", () => {
    const rows = [
      row("FFS", "FFS", 1317, "C".repeat(22)),
      row("FFS", "FFS", 60, "D".repeat(22)),
      row("Purry", "Meow", 45, "E".repeat(22)),
      row("Nujabes", "Modal Soul", 40, "F".repeat(22)),
      row("Various Artists", "Greatest Hits", 14, "G".repeat(22), { type: "compilation", spotify_artist: "Guns N' Roses" }),
      row("Various Artists", "Greatest Hits", 13, "H".repeat(22), { type: "compilation", spotify_artist: "The Association" }),
    ];
    const library = [libraryAlbum("Modal Soul", "Nujabes")];
    const { added, skipped } = triageAlbums(rows, library, { dropArtists: ["Purry"], newId, now: NOW });
    expect(added.map((a) => `${a.artists[0]} – ${a.title}`)).toEqual([
      "FFS – FFS",
      "Various Artists – Greatest Hits",
      "Various Artists – Greatest Hits",
    ]);
    expect(added[0].notes).toContain(`Other edition: https://open.spotify.com/album/${"D".repeat(22)} (60 plays).`);
    expect(added[1].notes).toContain("Spotify lists it as a compilation by Guns N' Roses.");
    expect(skipped.inLibrary).toBe(1);
    expect(skipped.dropped.map((r) => r.album)).toEqual(["Meow"]);
  });

  it("reads the rows of a CSV written by toCsv", () => {
    const [header, ...records] = parseCsv(toCsv([row("A, B", 'C "D"', 12, "J".repeat(22))]));
    const rows = records.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
    expect(triageAlbums(rows, [], { newId, now: NOW }).added[0]).toMatchObject({ title: 'C "D"', artists: ["A, B"] });
  });
});
