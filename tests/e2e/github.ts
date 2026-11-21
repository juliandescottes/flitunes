// A fake GitHub for the site tests (*.site.spec.ts): the data repository
// test-owner/test-library, holding library.json, served at its raw URL and
// through the REST API. The site is built with that URL (see
// playwright.config.ts).

import { expect, type Page } from "@playwright/test";
import type { LibraryFile } from "../../src/lib/model.ts";

const REPO = "test-owner/test-library";
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/main/library.json`;
const TOKEN_KEY = "album-library:github-token";

/** A token that can write to the repository. */
export const WRITE_TOKEN = "github_pat_write";
/** A token that can read the repository but not write to it. */
export const READ_TOKEN = "github_pat_read";
/** A token for another repository. */
export const OTHER_REPO_TOKEN = "github_pat_other";

export class FakeGitHub {
  /** library.json in the repository, and its blob sha. */
  file: LibraryFile;
  sha = "sha-1";
  /** Commits made through the API, oldest first. */
  commits: { message: string; branch: string | undefined; file: LibraryFile }[] = [];
  /** Tokens GitHub accepts. Remove one to revoke it. */
  tokens = new Set([WRITE_TOKEN, READ_TOKEN, OTHER_REPO_TOKEN]);
  #shas = 1;

  constructor(file: LibraryFile) {
    this.file = file;
  }

  /** Someone else commits library.json (another browser, a script). */
  commitElsewhere(file: LibraryFile) {
    this.file = file;
    this.sha = `sha-${++this.#shas}`;
  }

  async install(page: Page) {
    await page.route(RAW_URL, (route) => route.fulfill({ json: this.file }));
    await page.route("https://api.github.com/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const token = (await request.headerValue("authorization"))?.replace(/^Bearer /, "") ?? "";
      if (!this.tokens.has(token)) return route.fulfill({ status: 401, json: { message: "Bad credentials" } });
      const canRead = token !== OTHER_REPO_TOKEN;
      const path = url.pathname;

      if (path === `/repos/${REPO}` && request.method() === "GET") {
        if (!canRead) return route.fulfill({ status: 404, json: { message: "Not Found" } });
        return route.fulfill({ json: { full_name: REPO, permissions: { pull: true, push: token === WRITE_TOKEN } } });
      }
      if (path === `/repos/${REPO}/contents/library.json` && request.method() === "GET") {
        return route.fulfill({ json: { sha: this.sha, path: "library.json" } });
      }
      if (path === `/repos/${REPO}/git/blobs/${this.sha}` && request.method() === "GET") {
        return route.fulfill({ body: JSON.stringify(this.file), contentType: "application/vnd.github.raw+json" });
      }
      if (path === `/repos/${REPO}/contents/library.json` && request.method() === "PUT") {
        const body = request.postDataJSON() as { message: string; content: string; sha?: string; branch?: string };
        // Like GitHub: a commit names the sha it replaces, and that must still be the file's.
        if (body.sha === undefined) return route.fulfill({ status: 422, json: { message: '"sha" wasn\'t supplied.' } });
        if (body.sha !== this.sha) return route.fulfill({ status: 409, json: { message: "library.json does not match" } });
        const file = JSON.parse(Buffer.from(body.content, "base64").toString("utf8")) as LibraryFile;
        this.commits.push({ message: body.message, branch: body.branch, file });
        this.commitElsewhere(file);
        return route.fulfill({ json: { content: { sha: this.sha } } });
      }
      await route.fulfill({ status: 404, json: { message: "Not Found" } });
    });
  }
}

/** Keeps a GitHub token in the browser, as an earlier visit would have. */
export async function keepGitHubToken(page: Page, token: string) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [TOKEN_KEY, token]);
}

/**
 * Opens the site on a library kept in the fake GitHub repository. Requests
 * to other sites fail.
 */
export async function openSite(page: Page, github: FakeGitHub) {
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1:5184\/)/, (route) => route.abort());
  await github.install(page);
  await page.goto("/");
  await expect(page.getByText("Loading…")).toBeHidden();
}
