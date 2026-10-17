/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { libraryFile } from "./vite-plugins/library-file.ts";

const libraryPath = fileURLToPath(new URL("./data/library.json", import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [svelte(), libraryFile(libraryPath)],
  server: {
    // Spotify and other OAuth providers require a loopback IP, not "localhost".
    host: "127.0.0.1",
    // Writing library.json must not trigger a reload.
    watch: { ignored: ["**/data/**"] },
  },
  test: {
    environment: "node",
  },
});
