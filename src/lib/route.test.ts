import { describe, expect, it } from "vitest";
import { HOME, parseHash, replacesEntry, routeToHash, type Route } from "./route.ts";

const at = (change: Partial<Route>): Route => ({ ...HOME, ...change });

describe("routeToHash", () => {
  it("keeps the address clean for the plain library", () => {
    expect(routeToHash(HOME)).toBe("");
  });

  it("names the source and the filters", () => {
    expect(routeToHash(at({ source: { kind: "recent" } }))).toBe("#/recent");
    expect(routeToHash(at({ source: { kind: "triage" } }))).toBe("#/triage");
    expect(routeToHash(at({ genre: "jazz", artist: "Miles Davis" }))).toBe("#/music?genre=jazz&artist=Miles+Davis");
    expect(routeToHash(at({ search: "kind of", tracks: "01JA" }))).toBe("#/music?q=kind+of&tracks=01JA");
  });

  it("escapes playlist names", () => {
    expect(routeToHash(at({ source: { kind: "playlist", tag: "rainy day/night?" } }))).toBe(
      "#/playlist/rainy%20day%2Fnight%3F",
    );
  });
});

describe("parseHash", () => {
  it("round-trips every route", () => {
    const routes: Route[] = [
      HOME,
      at({ source: { kind: "recent" }, search: "a&b=c" }),
      at({ source: { kind: "triage" }, artist: "Islands" }),
      at({ source: { kind: "playlist", tag: "rainy day/night?" }, genre: "jazz", artist: "Café Tacvba", album: "Re" }),
      at({ tracks: "01JA", search: "#1" }),
    ];
    for (const route of routes) expect(parseHash(routeToHash(route))).toEqual(route);
  });

  it("reads anything unknown as the plain library", () => {
    expect(parseHash("")).toEqual(HOME);
    expect(parseHash("#")).toEqual(HOME);
    expect(parseHash("#/nowhere?x=1")).toEqual(HOME);
    expect(parseHash("#/playlist/%E0%A4%A")).toEqual(HOME);
  });
});

describe("replacesEntry", () => {
  it("adds an entry when a search starts, then replaces it while typing", () => {
    expect(replacesEntry(HOME, at({ search: "b" }))).toBe(false);
    expect(replacesEntry(at({ search: "b" }), at({ search: "bl" }))).toBe(true);
    expect(replacesEntry(at({ search: "blue" }), HOME)).toBe(true);
  });

  it("adds an entry for any other change", () => {
    expect(replacesEntry(at({ search: "b" }), at({ search: "b", genre: "jazz" }))).toBe(false);
    expect(replacesEntry(at({ search: "b", tracks: "01JA" }), at({ search: "bl" }))).toBe(false);
    expect(replacesEntry(HOME, at({ source: { kind: "recent" } }))).toBe(false);
  });
});
