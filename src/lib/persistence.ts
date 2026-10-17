// Access to library.json: fetched from the dev server (or the static build),
// and written back into the repo by the dev-server plugin.

import type { LibraryFile } from "./model.ts";
import { parseLibraryFile, serializeLibraryFile } from "./serialize.ts";

export interface LibrarySource {
  /** Returns the persisted library file, or null if there is none. */
  fetchFile(): Promise<LibraryFile | null>;
  /** Writes the library file into the repo. Only available in dev. */
  saveFile?(file: LibraryFile): Promise<void>;
}

const DEV_ENDPOINT = "/__library";

export const repoSource: LibrarySource = {
  async fetchFile() {
    const url = import.meta.env.DEV ? DEV_ENDPOINT : `${import.meta.env.BASE_URL}library.json`;
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
