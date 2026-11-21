import { defineConfig } from "@playwright/test";

// The e2e tests run against their own dev server, on a port of their own,
// with a fake Spotify client ID (so the sign-in button shows but no real
// account is ever reached) and a library path that doesn't exist: each test
// serves its own library by intercepting /__library (see testutils.ts), so
// the real library is never read or written.
const PORT = 5183;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "tests/e2e/tmp/results",
  // Retries hide flaky tests: check new ones with --repeat-each instead.
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: "chromium",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "UTC",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    // Never reuse a server: one started by hand may serve the real library.
    reuseExistingServer: false,
    env: {
      LIBRARY_PATH: "tests/e2e/tmp/no-library.json",
      VITE_SPOTIFY_CLIENT_ID: "fake-client",
    },
  },
});
