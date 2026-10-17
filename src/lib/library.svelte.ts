// Reactive library store. The in-memory state mirrors IndexedDB; every
// mutation is written to IndexedDB immediately and counted as an unsaved
// change until the library is exported to library.json.

import { ulid } from "ulid";
import type { LibraryDB } from "./db.ts";
import { slugify, type Album, type Genre, type LibraryFile } from "./model.ts";
import type { LibrarySource } from "./persistence.ts";
import { parseLibraryFile, toLibraryFile } from "./serialize.ts";

export type LibraryStatus =
  | { kind: "loading" }
  | { kind: "ready" }
  /** library.json is newer than the local copy, which also has unsaved changes. */
  | { kind: "conflict"; file: LibraryFile }
  | { kind: "error"; message: string };

export type AlbumPatch = Partial<Omit<Album, "id" | "addedAt">>;

export type AlbumInput = Partial<Omit<Album, "id" | "addedAt">> & Pick<Album, "title" | "artists">;

// Meta keys.
const BASE_EXPORTED_AT = "baseExportedAt"; // exportedAt of the file the local copy is based on
const UNSAVED_CHANGES = "unsavedChanges";

export class Library {
  // Raw state: arrays are replaced on change, never mutated in place.
  albums = $state.raw<Album[]>([]);
  genres = $state.raw<Genre[]>([]);
  unsavedChanges = $state(0);
  status = $state<LibraryStatus>({ kind: "loading" });

  #db: LibraryDB;
  #source: LibrarySource;

  constructor(db: LibraryDB, source: LibrarySource) {
    this.#db = db;
    this.#source = source;
  }

  get canSaveToRepo(): boolean {
    return this.#source.saveFile !== undefined;
  }

  async load(): Promise<void> {
    try {
      const db = this.#db;
      const [albums, genres, base, unsaved] = await Promise.all([
        db.albums.toArray(),
        db.genres.toArray(),
        db.getMeta<string | null>(BASE_EXPORTED_AT, null),
        db.getMeta(UNSAVED_CHANGES, 0),
      ]);
      this.albums = albums;
      this.genres = genres;
      this.unsavedChanges = unsaved;

      let file: LibraryFile | null = null;
      try {
        file = await this.#source.fetchFile();
      } catch (e) {
        console.warn("Could not load library.json, using local copy only", e);
      }

      if (file && isNewer(file.exportedAt, base)) {
        if (unsaved === 0) {
          await this.#replaceWith(file);
        } else {
          this.status = { kind: "conflict", file };
          return;
        }
      }
      this.status = { kind: "ready" };
    } catch (e) {
      this.status = { kind: "error", message: (e as Error).message };
    }
  }

  /** Resolves a conflict by keeping either library.json or the local copy. */
  async resolveConflict(keep: "file" | "local"): Promise<void> {
    if (this.status.kind !== "conflict") return;
    const { file } = this.status;
    if (keep === "file") {
      await this.#replaceWith(file);
    } else {
      // The local copy wins; the next export overwrites library.json.
      await this.#db.setMeta(BASE_EXPORTED_AT, file.exportedAt);
    }
    this.status = { kind: "ready" };
  }

  getAlbum(id: string): Album | undefined {
    return this.albums.find((a) => a.id === id);
  }

  /** Albums linked to the given Spotify URI (there should be at most one). */
  findBySpotify(uri: string): Album[] {
    return this.albums.filter((a) => a.spotify === uri);
  }

  async addAlbum(input: AlbumInput): Promise<Album> {
    const album = this.#normalizeAlbum({
      id: ulid(),
      addedAt: new Date().toISOString(),
      artistSort: null,
      year: null,
      genres: [],
      tags: [],
      rating: null,
      notes: "",
      spotify: null,
      cover: null,
      ...input,
    });
    await this.#mutate(() => this.#db.albums.add(album));
    this.albums = [...this.albums, album];
    return album;
  }

  async updateAlbum(id: string, patch: AlbumPatch): Promise<Album> {
    const current = this.getAlbum(id);
    if (!current) throw new Error(`Unknown album ${id}`);
    const album = this.#normalizeAlbum({ ...current, ...patch });
    await this.#mutate(() => this.#db.albums.put(album));
    this.#replaceAlbums([album]);
    return album;
  }

  /** Updates several albums in one write, e.g. from Multiple Item Information. */
  async updateAlbums(ids: string[], change: (album: Album) => AlbumPatch): Promise<void> {
    const updated = ids.map((id) => {
      const current = this.getAlbum(id);
      if (!current) throw new Error(`Unknown album ${id}`);
      return this.#normalizeAlbum({ ...current, ...change(current) });
    });
    await this.#mutate(() => this.#db.albums.bulkPut(updated));
    this.#replaceAlbums(updated);
  }

  async deleteAlbum(id: string): Promise<void> {
    await this.#mutate(() => this.#db.albums.delete(id));
    this.albums = this.albums.filter((a) => a.id !== id);
  }

  async addGenre(name: string): Promise<Genre> {
    const genre = { id: slugify(name), name: name.trim() };
    if (!genre.id) throw new Error("Genre name is empty");
    if (this.genres.some((g) => g.id === genre.id)) throw new Error(`Genre "${genre.name}" already exists`);
    await this.#mutate(() => this.#db.genres.add(genre));
    this.genres = [...this.genres, genre];
    return genre;
  }

  /** Renames a genre. Its id stays the same so album references are untouched. */
  async renameGenre(id: string, name: string): Promise<void> {
    const genre = { id, name: name.trim() };
    if (!genre.name) throw new Error("Genre name is empty");
    await this.#mutate(() => this.#db.genres.put(genre));
    this.genres = this.genres.map((g) => (g.id === id ? genre : g));
  }

  /** Deletes a genre and removes it from every album. */
  async deleteGenre(id: string): Promise<void> {
    const affected = this.albums
      .filter((a) => a.genres.includes(id))
      .map((a) => ({ ...a, genres: a.genres.filter((g) => g !== id) }));
    await this.#mutate(async () => {
      await this.#db.genres.delete(id);
      await this.#db.albums.bulkPut(affected);
    });
    this.genres = this.genres.filter((g) => g.id !== id);
    this.#replaceAlbums(affected);
  }

  /** Moves every album from genre `from` to genre `into`, then deletes `from`. */
  async mergeGenre(from: string, into: string): Promise<void> {
    if (from === into) return;
    if (!this.genres.some((g) => g.id === into)) throw new Error(`Unknown genre "${into}"`);
    const affected = this.albums
      .filter((a) => a.genres.includes(from))
      .map((a) => ({ ...a, genres: [...new Set(a.genres.map((g) => (g === from ? into : g)))] }));
    await this.#mutate(async () => {
      await this.#db.genres.delete(from);
      await this.#db.albums.bulkPut(affected);
    });
    this.genres = this.genres.filter((g) => g.id !== from);
    this.#replaceAlbums(affected);
  }

  /** Builds the library file for export. */
  snapshot(): LibraryFile {
    return toLibraryFile(this.albums, this.genres, new Date().toISOString());
  }

  /** Writes library.json into the repo (dev server only). */
  async saveToRepo(): Promise<void> {
    if (!this.#source.saveFile) throw new Error("Saving to the repo is only available in dev mode");
    const file = this.snapshot();
    await this.#source.saveFile(file);
    await this.markExported(file);
  }

  /** Records that `file` was exported, resetting the unsaved changes counter. */
  async markExported(file: LibraryFile): Promise<void> {
    await this.#db.transaction("rw", this.#db.meta, async () => {
      await this.#db.setMeta(BASE_EXPORTED_AT, file.exportedAt);
      await this.#db.setMeta(UNSAVED_CHANGES, 0);
    });
    this.unsavedChanges = 0;
  }

  /** Replaces the whole local library with the content of a JSON file. */
  async importJson(text: string): Promise<void> {
    await this.#replaceWith(parseLibraryFile(text));
  }

  async #replaceWith(file: LibraryFile): Promise<void> {
    const db = this.#db;
    await db.transaction("rw", db.albums, db.genres, db.meta, async () => {
      await db.albums.clear();
      await db.genres.clear();
      await db.albums.bulkAdd(file.albums);
      await db.genres.bulkAdd(file.genres);
      await db.setMeta(BASE_EXPORTED_AT, file.exportedAt);
      await db.setMeta(UNSAVED_CHANGES, 0);
    });
    this.albums = file.albums;
    this.genres = file.genres;
    this.unsavedChanges = 0;
  }

  #replaceAlbums(updated: Album[]): void {
    const byId = new Map(updated.map((a) => [a.id, a]));
    this.albums = this.albums.map((a) => byId.get(a.id) ?? a);
  }

  /** Runs a write in a transaction that also bumps the unsaved changes counter. */
  async #mutate(write: () => Promise<unknown>): Promise<void> {
    const db = this.#db;
    let count = 0;
    await db.transaction("rw", db.albums, db.genres, db.meta, async () => {
      await write();
      count = (await db.getMeta(UNSAVED_CHANGES, 0)) + 1;
      await db.setMeta(UNSAVED_CHANGES, count);
    });
    this.unsavedChanges = count;
  }

  #normalizeAlbum(album: Album): Album {
    const title = album.title.trim();
    if (!title) throw new Error("Album title is empty");
    const artists = cleanList(album.artists);
    if (artists.length === 0) throw new Error("Album needs at least one artist");
    const genres = cleanList(album.genres);
    const unknown = genres.find((id) => !this.genres.some((g) => g.id === id));
    if (unknown) throw new Error(`Unknown genre "${unknown}"`);
    if (album.rating !== null && !(Number.isInteger(album.rating) && album.rating >= 1 && album.rating <= 5)) {
      throw new Error("Rating must be 1-5 or null");
    }
    return {
      ...album,
      title,
      artists,
      artistSort: album.artistSort?.trim() || null,
      genres,
      tags: cleanList(album.tags),
      notes: album.notes.trim(),
    };
  }
}

function cleanList(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function isNewer(exportedAt: string, base: string | null): boolean {
  return base === null || Date.parse(exportedAt) > Date.parse(base);
}
