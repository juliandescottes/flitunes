import { describe, expect, it } from "vitest";
import type { Album } from "../../src/lib/model.ts";
import { coversToDownload, imageExtension, useDownloadedCovers } from "./lib.ts";

const album = (id: string, cover: string | null): Album => ({
  id,
  title: id,
  artists: ["Air"],
  artistSort: null,
  year: null,
  genres: [],
  tags: [],
  rating: null,
  notes: "",
  spotify: null,
  cover,
  addedAt: "2026-10-21T00:00:00.000Z",
});

const albums = [
  album("A1", "https://i.scdn.co/image/a"),
  album("B2", "https://i.scdn.co/image/b"),
  album("C3", "covers/C3.jpg"),
  album("D4", null),
];

describe("imageExtension", () => {
  it("maps image types and rejects the rest", () => {
    expect(imageExtension("image/jpeg")).toBe("jpg");
    expect(imageExtension("image/PNG; charset=binary")).toBe("png");
    expect(imageExtension("text/html")).toBeNull();
    expect(imageExtension(null)).toBeNull();
  });
});

describe("coversToDownload", () => {
  it("lists URL covers without a downloaded file", () => {
    expect(coversToDownload(albums, new Set(["B2.png"])).map((a) => a.id)).toEqual(["A1"]);
  });
});

describe("useDownloadedCovers", () => {
  it("points albums at their downloaded file and leaves the rest", () => {
    const { albums: updated, changed } = useDownloadedCovers(albums, new Set(["A1.jpg", "C3.jpg"]));
    expect(changed).toBe(1);
    expect(updated.map((a) => a.cover)).toEqual(["covers/A1.jpg", "https://i.scdn.co/image/b", "covers/C3.jpg", null]);
  });
});
