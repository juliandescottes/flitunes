// Pure helpers for covers.ts: which covers to download, and the library with
// its covers pointing at the downloaded files.

import { isLocalCover, type Album } from "../../src/lib/model.ts";

/** File extension for an image Content-Type, or null for anything else. */
export function imageExtension(contentType: string | null): "jpg" | "png" | "webp" | null {
  const type = contentType?.split(";")[0].trim().toLowerCase();
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return null;
}

/** Albums whose cover is still a URL, and have no downloaded file yet. */
export function coversToDownload(albums: Album[], files: Set<string>): Album[] {
  return albums.filter((a) => a.cover && !isLocalCover(a.cover) && !downloadedFile(a, files));
}

/** The album's downloaded cover in covers/, if any (by album id, any extension). */
export function downloadedFile(album: Album, files: Set<string>): string | null {
  for (const ext of ["jpg", "png", "webp"]) {
    if (files.has(`${album.id}.${ext}`)) return `covers/${album.id}.${ext}`;
  }
  return null;
}

/** Points the albums whose cover was downloaded at their file. */
export function useDownloadedCovers(albums: Album[], files: Set<string>): { albums: Album[]; changed: number } {
  let changed = 0;
  const updated = albums.map((a) => {
    if (!a.cover || isLocalCover(a.cover)) return a;
    const file = downloadedFile(a, files);
    if (!file) return a;
    changed++;
    return { ...a, cover: file };
  });
  return { albums: updated, changed };
}
