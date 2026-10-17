import Dexie, { type EntityTable } from "dexie";
import type { Album, Genre } from "./model.ts";

export interface MetaRow {
  key: string;
  value: unknown;
}

/** IndexedDB working copy of the library. */
export class LibraryDB extends Dexie {
  albums!: EntityTable<Album, "id">;
  genres!: EntityTable<Genre, "id">;
  meta!: EntityTable<MetaRow, "key">;

  constructor(name = "album-library") {
    super(name);
    this.version(1).stores({
      albums: "id, addedAt, *artists, *genres, *tags",
      genres: "id",
      meta: "key",
    });
  }

  async getMeta<T>(key: string, fallback: T): Promise<T> {
    const row = await this.meta.get(key);
    return row === undefined ? fallback : (row.value as T);
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.meta.put({ key, value });
  }
}
