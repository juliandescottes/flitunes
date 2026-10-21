/// <reference types="vitest/config" />
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { libraryFile } from "./vite-plugins/library-file.ts";

// The library lives in its own repo, cloned next to this one by default.
const libraryPath = process.env.LIBRARY_PATH
  ? resolve(process.env.LIBRARY_PATH)
  : fileURLToPath(new URL("../flitunes-library/library.json", import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [svelte(), libraryFile(libraryPath)],
  server: {
    // Spotify and other OAuth providers require a loopback IP, not "localhost".
    host: "127.0.0.1",
    // Writing library.json must not trigger a reload.
    watch: { ignored: [libraryPath] },
  },
  test: {
    environment: "node",
  },
});
