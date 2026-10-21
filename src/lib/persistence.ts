// Access to library.json, which lives in its own data repo. The dev server
// reads and writes a local clone of it; the static build fetches it from
// VITE_LIBRARY_URL (or a library.json next to index.html).

import { isLocalCover, type LibraryFile } from "./model.ts";
import { parseLibraryFile, serializeLibraryFile } from "./serialize.ts";

export interface LibrarySource {
  /** Returns the persisted library file, or null if there is none. */
  fetchFile(): Promise<LibraryFile | null>;
  /** Writes the library file to disk. Only available in dev. */
  saveFile?(file: LibraryFile): Promise<void>;
}

const DEV_ENDPOINT = "/__library";
const LIBRARY_URL: string = import.meta.env.VITE_LIBRARY_URL || `${import.meta.env.BASE_URL}library.json`;

/**
 * Where a cover shows from. A covers/ file is relative to library.json: the
 * dev server serves the clone's folder, the site the folder next to
 * VITE_LIBRARY_URL. URLs are used as they are.
 */
export function coverSrc(cover: string | null, base = libraryBase()): string | null {
  if (!cover) return null;
  return isLocalCover(cover) ? new URL(cover, base).href : cover;
}

function libraryBase(): string {
  const file = import.meta.env.DEV ? `${DEV_ENDPOINT}/library.json` : LIBRARY_URL;
  return new URL(".", new URL(file, location.href)).href;
}

export const repoSource: LibrarySource = {
  async fetchFile() {
    const url = import.meta.env.DEV ? DEV_ENDPOINT : LIBRARY_URL;
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to fetch library.json: HTTP ${res.status}`);
    return parseLibraryFile(await res.text());
  },
  saveFile: import.meta.env.DEV
    ? async (file) => {
        const res = await fetch(DEV_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: serializeLibraryFile(file),
        });
        if (!res.ok) throw new Error(`Failed to save library.json: ${await res.text()}`);
      }
    : undefined,
};

export function downloadLibraryFile(file: LibraryFile): void {
  const blob = new Blob([serializeLibraryFile(file)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "library.json";
  a.click();
  URL.revokeObjectURL(url);
}
