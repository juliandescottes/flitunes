// Dev only: serves the library file (a local clone of the data repo) to the
// app, and lets the app write it back via POST /__library. Covers stored with
// the library are served from its covers/ folder, at /__library/covers/<file>.
// The production build fetches the library from its URL instead (see
// persistence.ts).

import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { isLocalCover } from "../src/lib/model.ts";
import { parseLibraryFile, serializeLibraryFile } from "../src/lib/serialize.ts";

const ENDPOINT = "/__library";
const MAX_BODY_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

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
            // Only accept same-origin JSON requests, so that other sites open in
            // the browser can't overwrite the library (a cross-origin JSON POST
            // requires a CORS preflight, which the dev server doesn't grant).
            const origin = req.headers.origin;
            if (
              !req.headers["content-type"]?.startsWith("application/json") ||
              (origin !== undefined && new URL(origin).host !== req.headers.host)
            ) {
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
