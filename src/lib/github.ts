// Saving from the site: Save commits library.json to the data repo through
// the GitHub REST API, with a fine-grained personal access token kept in
// this browser only. GitHub's OAuth flow needs a server for the token
// exchange, so a token keeps the app backend-free. Without a token, the
// library is read from its public URL and Save asks for one.

import type { KeyValueStore } from "./spotify-auth.ts";
import type { LibraryFile } from "./model.ts";
import { SaveConflict, type LibrarySource } from "./persistence.ts";
import { parseLibraryFile, serializeLibraryFile } from "./serialize.ts";

const API = "https://api.github.com";
const TOKEN_KEY = "album-library:github-token";

/** Where library.json lives in the data repo. */
export interface RepoFile {
  owner: string;
  repo: string;
  /** null: the repository's default branch. */
  branch: string | null;
  path: string;
}

/** Save needs a token: there is none, or GitHub rejected it. */
export class TokenNeeded extends Error {}

/**
 * The repo file behind a library URL, for the two ways a GitHub repo serves
 * it: raw.githubusercontent.com/<owner>/<repo>/<branch>/<path> and GitHub
 * Pages, <owner>.github.io/<repo>/<path> (default branch, at the root).
 */
export function repoFileFromUrl(url: string): RepoFile | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const parts = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (parsed.hostname === "raw.githubusercontent.com" && parts.length >= 4) {
    const [owner, repo, branch, ...path] = parts;
    return { owner, repo, branch, path: path.join("/") };
  }
  const pages = /^([^.]+)\.github\.io$/i.exec(parsed.hostname);
  if (pages && parts.length >= 2) {
    const [repo, ...path] = parts;
    return { owner: pages[1], repo, branch: null, path: path.join("/") };
  }
  return null;
}

export class GitHubSource implements LibrarySource {
  readonly file: RepoFile;
  #public: LibrarySource;
  #storage: KeyValueStore;
  #fetch: typeof fetch;
  /** Blob sha of the last library.json fetched or saved, which a commit must name. */
  #sha: string | null = null;

  constructor(file: RepoFile, publicSource: LibrarySource, storage: KeyValueStore, fetchFn: typeof fetch) {
    this.file = file;
    this.#public = publicSource;
    this.#storage = storage;
    this.#fetch = fetchFn;
  }

  get repoName(): string {
    return `${this.file.owner}/${this.file.repo}`;
  }

  get hasToken(): boolean {
    return this.#token() !== null;
  }

  /** Checks that the token can write to the repo, then keeps it. */
  async setToken(token: string): Promise<void> {
    token = token.trim();
    const res = await this.#request(`/repos/${this.repoName}`, { token });
    if (res.status === 401) throw new Error("GitHub rejected this token.");
    if (res.status === 404) throw new Error(`This token has no access to ${this.repoName}.`);
    if (!res.ok) throw new Error(`GitHub: HTTP ${res.status}`);
    const repo = (await res.json()) as { permissions?: { push?: boolean } };
    if (!repo.permissions?.push) throw new Error(`This token can't write to ${this.repoName} (Contents: Read and write).`);
    this.#storage.setItem(TOKEN_KEY, token);
  }

  forgetToken(): void {
    this.#storage.removeItem(TOKEN_KEY);
  }

  async fetchFile(): Promise<LibraryFile | null> {
    const token = this.#token();
    if (!token) return this.#public.fetchFile();
    // The file's sha first, then that exact blob: the contents endpoint only
    // returns files up to 1 MB inline, and Pages caches for minutes.
    const ref = this.file.branch ? `?ref=${encodeURIComponent(this.file.branch)}` : "";
    const meta = await this.#request(`${this.#contentsPath()}${ref}`, { token, accept: "application/vnd.github.object+json" });
    if (meta.status === 401) {
      // Revoked or expired: read the public file, Save will ask again.
      this.forgetToken();
      return this.#public.fetchFile();
    }
    if (meta.status === 404) {
      this.#sha = null;
      return null;
    }
    if (!meta.ok) throw new Error(`Failed to fetch library.json from GitHub: HTTP ${meta.status}`);
    const { sha } = (await meta.json()) as { sha: string };
    const blob = await this.#request(`/repos/${this.repoName}/git/blobs/${sha}`, { token, accept: "application/vnd.github.raw+json" });
    if (!blob.ok) throw new Error(`Failed to fetch library.json from GitHub: HTTP ${blob.status}`);
    const file = parseLibraryFile(await blob.text());
    this.#sha = sha;
    return file;
  }

  async saveFile(file: LibraryFile, unsavedChanges: number): Promise<void> {
    const token = this.#token();
    if (!token) throw new TokenNeeded();
    const body = {
      message: `Update library (${unsavedChanges} ${unsavedChanges === 1 ? "change" : "changes"})`,
      content: toBase64(serializeLibraryFile(file)),
      ...(this.#sha ? { sha: this.#sha } : {}),
      ...(this.file.branch ? { branch: this.file.branch } : {}),
    };
    const res = await this.#request(this.#contentsPath(), { token, method: "PUT", body: JSON.stringify(body) });
    if (res.status === 401) {
      this.forgetToken();
      throw new TokenNeeded("GitHub rejected the saved token. Paste a new one.");
    }
    // 409: the file isn't at that sha any more. 422 without a sha: there is
    // a file, which this page hasn't read through the API.
    if (res.status === 409 || (res.status === 422 && !this.#sha)) throw new SaveConflict();
    if (!res.ok) throw new Error(`Failed to save library.json to GitHub: ${await errorMessage(res)}`);
    this.#sha = ((await res.json()) as { content: { sha: string } }).content.sha;
  }

  #token(): string | null {
    return this.#storage.getItem(TOKEN_KEY) || null;
  }

  #contentsPath(): string {
    return `/repos/${this.repoName}/contents/${this.file.path.split("/").map(encodeURIComponent).join("/")}`;
  }

  #request(path: string, options: { token: string; method?: string; accept?: string; body?: string }): Promise<Response> {
    return this.#fetch(`${API}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: options.accept ?? "application/vnd.github+json",
        Authorization: `Bearer ${options.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body,
      cache: "no-store",
    });
  }
}

/** Base64 of the UTF-8 bytes, in chunks (the file is over a megabyte). */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function errorMessage(res: Response): Promise<string> {
  try {
    return ((await res.json()) as { message?: string }).message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}
