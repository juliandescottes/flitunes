import { describe, expect, it } from "vitest";
import type { Album } from "./model.ts";
import { LibraryFormatError, parseLibraryFile, serializeLibraryFile, toLibraryFile } from "./serialize.ts";

const album = (id: string, extra: Partial<Album> = {}): Album => ({
  id,
  title: `Album ${id}`,
  artists: ["Artist"],
  artistSort: null,
  year: 1959,
  genres: ["jazz"],
  tags: [],
  rating: null,
  notes: "",
  spotify: null,
  cover: null,
  addedAt: "2026-10-17T09:00:00.000Z",
  ...extra,
});

const genres = [{ id: "jazz", name: "Jazz" }];

describe("serialize", () => {
  it("round-trips a library", () => {
    const file = toLibraryFile([album("b"), album("a")], genres, "2026-10-17T10:00:00.000Z");
    expect(parseLibraryFile(serializeLibraryFile(file))).toEqual(file);
  });

  it("is deterministic: sorted entries, fixed key order, sorted tags", () => {
    const shuffled = { ...album("a", { tags: ["z", "a"] }) };
    const reordered = Object.fromEntries(Object.entries(shuffled).reverse()) as unknown as Album;
    const one = serializeLibraryFile(toLibraryFile([album("b"), shuffled], genres, "2026-10-17T10:00:00.000Z"));
    const two = serializeLibraryFile(toLibraryFile([reordered, album("b")], genres, "2026-10-17T10:00:00.000Z"));
    expect(one).toBe(two);
    const parsed = JSON.parse(one);
    expect(parsed.albums.map((a: Album) => a.id)).toEqual(["a", "b"]);
    expect(Object.keys(parsed.albums[0])[0]).toBe("id");
    expect(parsed.albums[0].tags).toEqual(["a", "z"]);
    expect(one.endsWith("}\n")).toBe(true);
  });

  it("drops unknown keys", () => {
    const withExtra = { ...album("a"), extra: 1 } as Album;
    const parsed = JSON.parse(serializeLibraryFile(toLibraryFile([withExtra], genres, "2026-10-17T10:00:00.000Z")));
    expect(parsed.albums[0]).not.toHaveProperty("extra");
  });

  it.each([
    ["invalid JSON", "{"],
    ["wrong schema version", JSON.stringify({ schemaVersion: 2, exportedAt: "2026-01-01T00:00:00Z", genres: [], albums: [] })],
    ["bad rating", JSON.stringify({ schemaVersion: 1, exportedAt: "2026-01-01T00:00:00Z", genres, albums: [album("a", { rating: 7 })] })],
    ["unknown genre", JSON.stringify({ schemaVersion: 1, exportedAt: "2026-01-01T00:00:00Z", genres: [], albums: [album("a")] })],
    ["duplicate ids", JSON.stringify({ schemaVersion: 1, exportedAt: "2026-01-01T00:00:00Z", genres, albums: [album("a"), album("a")] })],
    ["a javascript: Spotify link", JSON.stringify({ schemaVersion: 1, exportedAt: "2026-01-01T00:00:00Z", genres, albums: [album("a", { spotify: "javascript:alert(1)" })] })],
    ["a Spotify track link", JSON.stringify({ schemaVersion: 1, exportedAt: "2026-01-01T00:00:00Z", genres, albums: [album("a", { spotify: "spotify:track:abc" })] })],
    ["an http: cover", JSON.stringify({ schemaVersion: 1, exportedAt: "2026-01-01T00:00:00Z", genres, albums: [album("a", { cover: "http://example.com/a.jpg" })] })],
    ["a cover outside covers/", JSON.stringify({ schemaVersion: 1, exportedAt: "2026-01-01T00:00:00Z", genres, albums: [album("a", { cover: "covers/../library.json" })] })],
    ["missing title", JSON.stringify({ schemaVersion: 1, exportedAt: "2026-01-01T00:00:00Z", genres, albums: [{ ...album("a"), title: 3 }] })],
  ])("rejects %s", (_, text) => {
    expect(() => parseLibraryFile(text)).toThrow(LibraryFormatError);
  });

  it("accepts Spotify album and playlist URIs, https: covers and covers/ files", () => {
    const albums = [
      album("a", { spotify: "spotify:album:1weenld61qoidwYuZ1GESA", cover: "https://i.scdn.co/image/ab67" }),
      album("b", { spotify: "spotify:playlist:37i9dQZF1DX0XUsuxWHRQd", cover: "covers/b.jpg" }),
    ];
    const file = toLibraryFile(albums, genres, "2026-10-17T10:00:00.000Z");
    expect(parseLibraryFile(serializeLibraryFile(file))).toEqual(file);
  });
});
