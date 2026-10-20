// Performance budgets for browsing a large library (3000 mock albums).
// The budgets are several times the measured times (about 1 ms per call on
// a 2024 laptop), so that they catch regressions without being flaky.
import { describe, expect, it } from "vitest";
import { browse, type BrowseState } from "./browse.ts";
import { mockLibrary } from "./mock.ts";

const { albums, genres } = mockLibrary({ albums: 3000 });
const state: BrowseState = {
  source: { kind: "music" },
  search: "",
  linkedOnly: false,
  genre: null,
  artist: null,
  album: null,
  sortKey: "artist",
  sortDir: "asc",
};

/** Median time of `run` in milliseconds, after a warm-up. */
function median(run: () => void, times = 30): number {
  for (let i = 0; i < 5; i++) run();
  const samples: number[] = [];
  for (let i = 0; i < times; i++) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }
  return samples.sort((a, b) => a - b)[Math.floor(times / 2)];
}

describe("browse performance (3000 albums)", () => {
  it("types a search quickly", () => {
    const queries = ["b", "bl", "blu", "blue", "blue n", "blue ni", ""];
    expect(median(() => queries.forEach((search) => browse(albums, genres, { ...state, search })))).toBeLessThan(40);
  });

  it("filters by genre and artist quickly", () => {
    const artist = albums[0].artists[0];
    expect(median(() => browse(albums, genres, { ...state, genre: genres[0].id }))).toBeLessThan(10);
    expect(median(() => browse(albums, genres, { ...state, artist }))).toBeLessThan(10);
  });

  it("changes the sort quickly, even uncached", () => {
    let i = 0;
    const keys = ["title", "year", "genre", "rating", "addedAt", "artist"] as const;
    expect(median(() => browse(albums, genres, { ...state, sortKey: keys[i++ % keys.length] }))).toBeLessThan(60);
  });

  it("keeps the order when filtering", () => {
    const all = browse(albums, genres, state).albums;
    const searched = browse(albums, genres, { ...state, search: "blue" }).albums;
    const positions = searched.map((a) => all.indexOf(a));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(searched.length).toBeGreaterThan(0);
  });
});
