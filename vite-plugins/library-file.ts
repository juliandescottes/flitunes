// Serves data/library.json to the app and, in dev only, lets the app write it
// back into the repo via POST /__library. The production build ships a copy
// of the file next to index.html.

import { readFile, rename, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import type { Plugin } from "vite";
import { parseLibraryFile, serializeLibraryFile } from "../src/lib/serialize.ts";

const ENDPOINT = "/__library";
const MAX_BODY_BYTES = 50 * 1024 * 1024;

export function libraryFile(path: string): Plugin {
  return {
    name: "library-file",

    configureServer(server) {
      server.middlewares.use(ENDPOINT, async (req, res) => {
        try {
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

    generateBundle() {
      this.emitFile({ type: "asset", fileName: "library.json", source: readFileSync(path) });
    },
  };
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
