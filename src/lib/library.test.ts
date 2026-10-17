import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { LibraryDB } from "./db.ts";
import { Library } from "./library.svelte.ts";
import type { LibraryFile } from "./model.ts";
import type { LibrarySource } from "./persistence.ts";

class MemorySource implements LibrarySource {
  file: LibraryFile | null = null;
  async fetchFile() {
    return this.file;
  }
  async saveFile(file: LibraryFile) {
    this.file = file;
  }
}

let dbCount = 0;
let db: LibraryDB;
let source: MemorySource;

const fileWith = (exportedAt: string, titles: string[]): LibraryFile => ({
  schemaVersion: 1,
  exportedAt,
  genres: [],
  albums: titles.map((title, i) => ({
    id: `id${i}`,
    title,
    artists: ["Artist"],
    artistSort: null,
    year: null,
    genres: [],
    tags: [],
    rating: null,
    notes: "",
    spotify: null,
    cover: null,
    addedAt: exportedAt,
  })),
});

async function openLibrary() {
  const library = new Library(db, source);
  await library.load();
  return library;
}

beforeEach(() => {
  db = new LibraryDB(`test-${dbCount++}`);
  source = new MemorySource();
});

describe("Library", () => {
  it("seeds an empty local copy from library.json", async () => {
    source.file = fileWith("2026-10-01T00:00:00.000Z", ["Kind of Blue"]);
    const library = await openLibrary();
    expect(library.status.kind).toBe("ready");
    expect(library.albums.map((a) => a.title)).toEqual(["Kind of Blue"]);
    expect(library.unsavedChanges).toBe(0);
  });

  it("persists mutations to IndexedDB and counts unsaved changes", async () => {
    const library = await openLibrary();
    const jazz = await library.addGenre("Jazz");
    const album = await library.addAlbum({ title: " Kind of Blue ", artists: ["Miles Davis", ""], genres: [jazz.id] });
    await library.updateAlbum(album.id, { rating: 5, tags: ["modal", "modal "] });
    expect(library.unsavedChanges).toBe(3);

    const reopened = await openLibrary();
    expect(reopened.unsavedChanges).toBe(3);
    expect(reopened.albums).toHaveLength(1);
    expect(reopened.albums[0]).toMatchObject({
      title: "Kind of Blue",
      artists: ["Miles Davis"],
      genres: ["jazz"],
      rating: 5,
      tags: ["modal"],
    });
  });

  it("validates input", async () => {
    const library = await openLibrary();
    await expect(library.addAlbum({ title: "", artists: ["A"] })).rejects.toThrow();
    await expect(library.addAlbum({ title: "T", artists: [] })).rejects.toThrow();
    await expect(library.addAlbum({ title: "T", artists: ["A"], genres: ["nope"] })).rejects.toThrow(/genre/);
    await expect(library.addAlbum({ title: "T", artists: ["A"], rating: 6 })).rejects.toThrow(/Rating/);
    await library.addGenre("Hip-Hop");
    await expect(library.addGenre("hip hop")).rejects.toThrow(/exists/);
    expect(library.albums).toHaveLength(0);
  });

  it("deleting a genre removes it from albums", async () => {
    const library = await openLibrary();
    await library.addGenre("Jazz");
    await library.addGenre("Soul");
    const album = await library.addAlbum({ title: "T", artists: ["A"], genres: ["soul", "jazz"] });
    await library.deleteGenre("soul");
    expect(library.getAlbum(album.id)?.genres).toEqual(["jazz"]);
    expect((await openLibrary()).albums[0].genres).toEqual(["jazz"]);
  });

  it("merging a genre moves its albums and deletes it", async () => {
    const library = await openLibrary();
    await library.addGenre("Hip-Hop");
    await library.addGenre("Rap");
    await library.addGenre("Soul");
    const both = await library.addAlbum({ title: "A", artists: ["X"], genres: ["rap", "soul", "hip-hop"] });
    const one = await library.addAlbum({ title: "B", artists: ["X"], genres: ["soul", "rap"] });
    await library.mergeGenre("rap", "hip-hop");
    expect(library.genres.map((g) => g.id)).toEqual(["hip-hop", "soul"]);
    expect(library.getAlbum(both.id)?.genres).toEqual(["hip-hop", "soul"]);
    expect(library.getAlbum(one.id)?.genres).toEqual(["soul", "hip-hop"]);
    expect((await openLibrary()).genres).toHaveLength(2);
  });

  it("updates several albums in one change", async () => {
    const library = await openLibrary();
    const a = await library.addAlbum({ title: "A", artists: ["X"], tags: ["old"] });
    const b = await library.addAlbum({ title: "B", artists: ["Y"] });
    const before = library.unsavedChanges;
    await library.updateAlbums([a.id, b.id], (album) => ({ rating: 4, tags: [...album.tags, "vinyl"] }));
    expect(library.unsavedChanges).toBe(before + 1);
    expect(library.albums.map((x) => [x.title, x.rating, x.tags])).toEqual([
      ["A", 4, ["old", "vinyl"]],
      ["B", 4, ["vinyl"]],
    ]);
    await expect(library.updateAlbums([a.id], () => ({ rating: 9 }))).rejects.toThrow(/Rating/);
    expect(library.getAlbum(a.id)?.rating).toBe(4);
  });

  it("saving to the repo resets unsaved changes", async () => {
    const library = await openLibrary();
    await library.addAlbum({ title: "T", artists: ["A"] });
    await library.saveToRepo();
    expect(library.unsavedChanges).toBe(0);
    expect(source.file?.albums.map((a) => a.title)).toEqual(["T"]);
    // Reopening with the file we just saved is not a conflict.
    expect((await openLibrary()).status.kind).toBe("ready");
  });

  it("loads a newer library.json when there are no local changes", async () => {
    source.file = fileWith("2026-10-01T00:00:00.000Z", ["A"]);
    await openLibrary();
    source.file = fileWith("2026-10-02T00:00:00.000Z", ["A", "B"]); // e.g. after a git pull
    const library = await openLibrary();
    expect(library.status.kind).toBe("ready");
    expect(library.albums).toHaveLength(2);
  });

  it("reports a conflict when library.json is newer and there are local changes", async () => {
    source.file = fileWith("2026-10-01T00:00:00.000Z", ["A"]);
    const first = await openLibrary();
    await first.addAlbum({ title: "Local", artists: ["X"] });
    source.file = fileWith("2026-10-02T00:00:00.000Z", ["A", "B"]);

    const keepFile = await openLibrary();
    expect(keepFile.status.kind).toBe("conflict");
    await keepFile.resolveConflict("file");
    expect(keepFile.albums.map((a) => a.title)).toEqual(["A", "B"]);
    expect(keepFile.unsavedChanges).toBe(0);
  });

  it("keeping the local copy on conflict stops asking", async () => {
    source.file = fileWith("2026-10-01T00:00:00.000Z", ["A"]);
    const first = await openLibrary();
    await first.addAlbum({ title: "Local", artists: ["X"] });
    source.file = fileWith("2026-10-02T00:00:00.000Z", ["A", "B"]);

    const keepLocal = await openLibrary();
    await keepLocal.resolveConflict("local");
    expect(keepLocal.albums.map((a) => a.title).sort()).toEqual(["A", "Local"]);
    expect(keepLocal.unsavedChanges).toBe(1);
    expect((await openLibrary()).status.kind).toBe("ready");
  });

  it("uses the local copy when library.json can't be fetched", async () => {
    const library = await openLibrary();
    await library.addAlbum({ title: "T", artists: ["A"] });
    source.fetchFile = async () => {
      throw new Error("offline");
    };
    const reopened = await openLibrary();
    expect(reopened.status.kind).toBe("ready");
    expect(reopened.albums).toHaveLength(1);
  });
});
