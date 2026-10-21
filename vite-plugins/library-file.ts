// Dev only: serves the library file (a local clone of the data repo) to the
// app, and lets the app write it back via POST /__library. Covers stored with
// the library are served from its covers/ folder, at /__library/covers/<file>,
// and POST /__library/covers copies a new album's cover there from its URL.
// The production build fetches the library from its URL instead (see
// persistence.ts).

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { isLocalCover } from "../src/lib/model.ts";
import { parseLibraryFile, serializeLibraryFile } from "../src/lib/serialize.ts";
import { imageExtension } from "../scripts/covers/lib.ts";

const ENDPOINT = "/__library";
const MAX_BODY_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const MAX_COVER_BYTES = 20 * 1024 * 1024;
const COVER_TIMEOUT_MS = 20_000;
const USER_AGENT = "FliTunes-covers/1.0 (+https://github.com/juliandescottes/flitunes)";

export function libraryFile(path: string): Plugin {
  return {
    name: "library-file",

    configureServer(server) {
      server.middlewares.use(ENDPOINT, async (req, res) => {
        try {
          const sub = (req.url ?? "/").split("?")[0];
          if (sub.startsWith("/covers/") && req.method === "GET") {
            await serveCover(dirname(path), sub.slice(1), res);
            return;
          }
          if (sub === "/covers" && req.method === "POST") {
            if (!isSameOriginJson(req)) {
              res.statusCode = 403;
              res.end("Forbidden");
              return;
            }
            const { albumId, url } = JSON.parse(await readBody(req)) as { albumId?: unknown; url?: unknown };
            const cover = await keepCover(dirname(path), albumId, url);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ cover }));
            return;
          }
          if (sub !== "/") {
            res.statusCode = 404;
            res.end();
            return;
          }
          if (req.method === "GET") {
            const text = await readFile(path, "utf8").catch((e) => {
              if (e.code === "ENOENT") return null;
              throw e;
            });
            if (text === null) {
              res.statusCode = 404;
              res.end();
              return;
            }
            res.setHeader("Content-Type", "application/json");
            res.end(text);
          } else if (req.method === "POST") {
            if (!isSameOriginJson(req)) {
              res.statusCode = 403;
              res.end("Forbidden");
              return;
            }
            // Validate and re-serialize so the file on disk is always well-formed.
            const text = serializeLibraryFile(parseLibraryFile(await readBody(req)));
            const tmp = `${path}.tmp`;
            await writeFile(tmp, text, "utf8");
            await rename(tmp, path);
            res.statusCode = 204;
            res.end();
          } else {
            res.statusCode = 405;
            res.end();
          }
        } catch (e) {
          res.statusCode = 400;
          res.end((e as Error).message);
        }
      });
    },
  };
}

/**
 * Only same-origin JSON requests, so that other sites open in the browser
 * can't write to the library (a cross-origin JSON POST requires a CORS
 * preflight, which the dev server doesn't grant).
 */
function isSameOriginJson(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  return (
    req.headers["content-type"]?.startsWith("application/json") === true &&
    (origin === undefined || new URL(origin).host === req.headers.host)
  );
}

/**
 * Downloads an album's cover (an https: URL) into covers/<album id>.<ext>,
 * replacing any earlier file of that album, and returns its path.
 */
async function keepCover(folder: string, albumId: unknown, url: unknown): Promise<string> {
  if (typeof albumId !== "string" || !/^[A-Za-z0-9_-]+$/.test(albumId)) throw new Error("Invalid album id");
  if (typeof url !== "string" || !url.startsWith("https://")) throw new Error("The cover must be an https: URL");
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(COVER_TIMEOUT_MS) });
  const ext = imageExtension(res.headers.get("content-type"));
  if (!res.ok || !ext) throw new Error(res.ok ? "The cover URL isn't an image" : `The cover URL answered HTTP ${res.status}`);
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length > MAX_COVER_BYTES) throw new Error("The cover is too large");
  const coversDir = join(folder, "covers");
  await mkdir(coversDir, { recursive: true });
  for (const other of Object.keys(IMAGE_TYPES)) await rm(join(coversDir, `${albumId}.${other}`), { force: true });
  const tmp = join(coversDir, `.${albumId}.tmp`);
  await writeFile(tmp, data);
  await rename(tmp, join(coversDir, `${albumId}.${ext}`));
  return `covers/${albumId}.${ext}`;
}

/** Serves covers/<file> from the library folder. Only plain file names match, so no path leaves the folder. */
async function serveCover(folder: string, cover: string, res: ServerResponse): Promise<void> {
  const name = decodeURIComponent(cover);
  if (!isLocalCover(name)) {
    res.statusCode = 404;
    res.end();
    return;
  }
  const data = await readFile(join(folder, name)).catch(() => null);
  if (!data) {
    res.statusCode = 404;
    res.end();
    return;
  }
  res.setHeader("Content-Type", IMAGE_TYPES[name.split(".").pop()!]);
  res.setHeader("Cache-Control", "no-cache");
  res.end(data);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
