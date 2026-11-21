import { defineConfig } from "@playwright/test";

// The e2e tests run against servers of their own, on ports of their own, with
// a fake Spotify client ID (so the sign-in button shows but no real account
// is ever reached):
//
// - "dev": the dev server, with a library path that doesn't exist. Each test
//   serves its own library by intercepting /__library (see testutils.ts), so
//   the real library is never read or written.
// - "site": the static build, as GitHub Pages serves it, reading the library
//   from a GitHub repository that the tests fake (*.site.spec.ts files, see
//   github.ts in this folder).
const DEV_PORT = 5183;
const SITE_PORT = 5184;
const SITE_DIR = "tests/e2e/tmp/site";
// The library URL the site is built with: test-owner/test-library on GitHub,
// which tests/e2e/github.ts fakes.
const SITE_LIBRARY_URL = "https://raw.githubusercontent.com/test-owner/test-library/main/library.json";

export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: "tmp/**",
  outputDir: "tests/e2e/tmp/results",
  // Retries hide flaky tests: check new ones with --repeat-each instead.
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    browserName: "firefox",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "UTC",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "dev",
      testIgnore: ["tmp/**", "**/*.site.spec.ts"],
      use: { baseURL: `http://127.0.0.1:${DEV_PORT}` },
    },
    {
      name: "site",
      testMatch: "**/*.site.spec.ts",
      use: { baseURL: `http://127.0.0.1:${SITE_PORT}` },
    },
  ],
  // Never reuse a server: one started by hand may serve the real library.
  webServer: [
    {
      command: `npx vite --port ${DEV_PORT} --strictPort`,
      url: `http://127.0.0.1:${DEV_PORT}`,
      reuseExistingServer: false,
      env: {
        LIBRARY_PATH: "tests/e2e/tmp/no-library.json",
        VITE_SPOTIFY_CLIENT_ID: "fake-client",
      },
    },
    {
      command: `npx vite build --outDir ${SITE_DIR} --emptyOutDir --logLevel warn && npx vite preview --outDir ${SITE_DIR} --host 127.0.0.1 --port ${SITE_PORT} --strictPort`,
      url: `http://127.0.0.1:${SITE_PORT}`,
      reuseExistingServer: false,
      env: {
        LIBRARY_PATH: "tests/e2e/tmp/no-library.json",
        VITE_LIBRARY_URL: SITE_LIBRARY_URL,
        VITE_SPOTIFY_CLIENT_ID: "fake-client",
      },
    },
  ],
});
