import { describe, expect, it } from "vitest";
import { browse, playlists, typeAhead, type BrowseState } from "./browse.ts";
import type { Album, Genre } from "./model.ts";

const NOW = Date.parse("2026-10-17T00:00:00Z");

let n = 0;
function album(title: string, artists: string[], extra: Partial<Album> = {}): Album {
  return {
    id: `id${n++}`,
    title,
    artists,
    artistSort: null,
    year: null,
    genres: [],
    tags: [],
    rating: null,
    notes: "",
    spotify: null,
    cover: null,
    addedAt: "2026-01-01T00:00:00Z",
    ...extra,
  };
}

const genres: Genre[] = [
  { id: "jazz", name: "Jazz" },
  { id: "rock", name: "Rock" },
  { id: "electronic", name: "Électronique" },
];

const kindOfBlue = album("Kind of Blue", ["Miles Davis"], { year: 1959, genres: ["jazz"], rating: 5, tags: ["vinyl"] });
const kindOfBlueLegacy = album("Kind of Blue", ["Miles Davis"], { year: 2008, genres: ["jazz"] });
const abbeyRoad = album("Abbey Road", ["The Beatles"], { year: 1969, genres: ["rock"], tags: ["vinyl", "summer"] });
const discovery = album("Discovery", ["Daft Punk"], {
  year: 2001,
  genres: ["electronic", "rock"],
  addedAt: "2026-10-10T00:00:00Z",
});
const various = album("Jazz Hits", ["Various Artists"], { genres: ["jazz"] });
const albums = [kindOfBlue, kindOfBlueLegacy, abbeyRoad, discovery, various];

const state = (patch: Partial<BrowseState> = {}): BrowseState => ({
  source: { kind: "music" },
  search: "",
  linkedOnly: false,
  genre: null,
  artist: null,
  album: null,
  sortKey: "artist",
  sortDir: "asc",
  ...patch,
});

const titles = (list: Album[]) => list.map((a) => `${a.title}${a.year ? ` (${a.year})` : ""}`);

describe("browse", () => {
  it("lists every album, sorted by artist ignoring 'The', then year", () => {
    const result = browse(albums, genres, state(), NOW);
    expect(result.total).toBe(5);
    expect(titles(result.albums)).toEqual([
      "Abbey Road (1969)",
      "Discovery (2001)",
      "Kind of Blue (1959)",
      "Kind of Blue (2008)",
      "Jazz Hits",
    ]);
  });

  it("builds the column browser with counts, albums counting under each genre", () => {
    const result = browse(albums, genres, state(), NOW);
    expect(result.genres).toEqual([
      { key: "electronic", label: "Électronique", count: 1 },
      { key: "jazz", label: "Jazz", count: 3 },
      { key: "rock", label: "Rock", count: 2 },
    ]);
    expect(result.artists.map((a) => a.key)).toEqual(["The Beatles", "Daft Punk", "Miles Davis", "Various Artists"]);
    expect(result.albumTitles.find((a) => a.key === "Kind of Blue")?.count).toBe(2);
  });

  it("cascades the column selections", () => {
    const result = browse(albums, genres, state({ genre: "jazz", artist: "Miles Davis" }), NOW);
    expect(result.artists.map((a) => a.key)).toEqual(["Miles Davis", "Various Artists"]);
    expect(result.albumTitles.map((a) => a.key)).toEqual(["Kind of Blue"]);
    expect(titles(result.albums)).toEqual(["Kind of Blue (1959)", "Kind of Blue (2008)"]);
  });

  it("falls back to All when a selection is no longer listed", () => {
    const result = browse(albums, genres, state({ genre: "rock", artist: "Miles Davis" }), NOW);
    expect(result.artist).toBeNull();
    expect(titles(result.albums)).toEqual(["Abbey Road (1969)", "Discovery (2001)"]);
  });

  it("searches title, artist, genre and tags, ignoring case and accents", () => {
    const search = (q: string) => titles(browse(albums, genres, state({ search: q }), NOW).albums);
    expect(search("beatles")).toEqual(["Abbey Road (1969)"]);
    expect(search("electronique")).toEqual(["Discovery (2001)"]);
    expect(search("miles 1959")).toEqual(["Kind of Blue (1959)"]);
    expect(search("summer")).toEqual(["Abbey Road (1969)"]);
  });

  it("filters by source", () => {
    const recent = browse(albums, genres, state({ source: { kind: "recent" } }), NOW);
    expect(titles(recent.albums)).toEqual(["Discovery (2001)"]);
    const vinyl = browse(albums, genres, state({ source: { kind: "playlist", tag: "vinyl" } }), NOW);
    expect(titles(vinyl.albums)).toEqual(["Abbey Road (1969)", "Kind of Blue (1959)"]);
    expect(playlists(albums)).toEqual(["summer", "vinyl"]);
  });

  it("shows albums in triage only in the Triage source", () => {
    const pending = album("Taste", ["Islands"], {
      genres: ["rock"],
      tags: ["triage", "summer"],
      addedAt: "2026-10-16T00:00:00Z",
    });
    const all = [...albums, pending];
    const shown = (source: BrowseState["source"]) => titles(browse(all, genres, state({ source }), NOW).albums);
    expect(shown({ kind: "triage" })).toEqual(["Taste"]);
    expect(shown({ kind: "music" })).not.toContain("Taste");
    expect(shown({ kind: "recent" })).toEqual(["Discovery (2001)"]);
    expect(shown({ kind: "playlist", tag: "summer" })).toEqual(["Abbey Road (1969)"]);
    expect(titles(browse(all, genres, state({ search: "islands" }), NOW).albums)).toEqual([]);
    expect(playlists(all)).toEqual(["summer", "vinyl"]);
  });

  it("hides albums without a Spotify link", () => {
    const linked = album("Linked", ["Someone"], { genres: ["rock"], spotify: "spotify:album:4LH4d3cOWNNsVw41Gqt2kv" });
    const result = browse([...albums, linked], genres, state({ linkedOnly: true }), NOW);
    expect(titles(result.albums)).toEqual(["Linked"]);
    expect(result.artists.map((a) => a.key)).toEqual(["Someone"]);
    expect(result.genres.map((g) => g.key)).toEqual(["rock"]);
  });

  it("sorts by any column, missing values last", () => {
    const sorted = (patch: Partial<BrowseState>) => titles(browse(albums, genres, state(patch), NOW).albums);
    expect(sorted({ sortKey: "year" })).toEqual([
      "Kind of Blue (1959)",
      "Abbey Road (1969)",
      "Discovery (2001)",
      "Kind of Blue (2008)",
      "Jazz Hits",
    ]);
    expect(sorted({ sortKey: "rating", sortDir: "desc" })[0]).toBe("Kind of Blue (1959)");
    expect(sorted({ sortKey: "title" })).toEqual([
      "Abbey Road (1969)",
      "Discovery (2001)",
      "Jazz Hits",
      "Kind of Blue (1959)",
      "Kind of Blue (2008)",
    ]);
  });

  it("jumps to the first album starting with the typed text", () => {
    const list = browse(albums, genres, state({}), NOW).albums;
    const genreNames = new Map(genres.map((g) => [g.id, g.name]));
    expect(typeAhead(list, "ki", "title", genreNames)?.title).toBe("Kind of Blue");
    expect(typeAhead(list, "beat", "artist", genreNames)?.title).toBe("Abbey Road");
    expect(typeAhead(list, "200", "year", genreNames)?.title).toBe("Discovery");
    expect(typeAhead(list, "zz", "title", genreNames)).toBeNull();
  });
});
