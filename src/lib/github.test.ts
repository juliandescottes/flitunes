import { describe, expect, it } from "vitest";
import { GitHubSource, repoFileFromUrl, TokenNeeded, type RepoFile } from "./github.ts";
import type { LibraryFile } from "./model.ts";
import { SaveConflict, type LibrarySource } from "./persistence.ts";
import { parseLibraryFile, serializeLibraryFile } from "./serialize.ts";

describe("repoFileFromUrl", () => {
  it("reads raw.githubusercontent.com and GitHub Pages URLs", () => {
    expect(repoFileFromUrl("https://raw.githubusercontent.com/someone/flitunes-library/main/library.json")).toEqual({
      owner: "someone",
      repo: "flitunes-library",
      branch: "main",
      path: "library.json",
    });
    expect(repoFileFromUrl("https://someone.github.io/flitunes-library/data/library.json")).toEqual({
      owner: "someone",
      repo: "flitunes-library",
      branch: null,
      path: "data/library.json",
    });
  });

  it("has nothing for other URLs", () => {
    expect(repoFileFromUrl("https://example.com/library.json")).toBeNull();
    expect(repoFileFromUrl("https://someone.github.io/library.json")).toBeNull();
    expect(repoFileFromUrl("/library.json")).toBeNull();
  });
});

const file = (exportedAt: string, title = "Kind of Blue"): LibraryFile => ({
  schemaVersion: 1,
  exportedAt,
  genres: [],
  albums: [
    {
      id: "id0",
      title,
      artists: ["Miles Davis"],
      artistSort: null,
      year: null,
      genres: [],
      tags: [],
      rating: null,
      notes: "",
      spotify: null,
      cover: null,
      addedAt: exportedAt,
    },
  ],
});

/** Just enough of the GitHub API: one repo with one file, blobs by sha. */
class FakeGitHub {
  token = "good";
  canPush = true;
  content: string | null = null;
  sha: string | null = null;
  blobs = new Map<string, string>();
  commits: { message: string; branch?: string }[] = [];
  #shas = 0;

  write(text: string) {
    this.sha = `sha${this.#shas++}`;
    this.content = text;
    this.blobs.set(this.sha, text);
  }

  fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = init?.headers as Record<string, string>;
    if (headers.Authorization !== `Bearer ${this.token}`) return json(401, { message: "Bad credentials" });
    const path = url.pathname;
    if (path === "/repos/someone/flitunes-library") return json(200, { permissions: { push: this.canPush } });
    if (path === "/repos/someone/flitunes-library/contents/library.json") {
      if (init?.method === "PUT") {
        const body = JSON.parse(init.body as string);
        if (this.sha && !body.sha) return json(422, { message: '"sha" wasn\'t supplied.' });
        if (body.sha !== (this.sha ?? undefined)) return json(409, { message: "does not match" });
        this.write(new TextDecoder().decode(Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0))));
        this.commits.push({ message: body.message, branch: body.branch });
        return json(200, { content: { sha: this.sha } });
      }
      return this.sha ? json(200, { sha: this.sha, content: "", encoding: "none" }) : json(404, { message: "Not Found" });
    }
    const blob = /^\/repos\/someone\/flitunes-library\/git\/blobs\/(.+)$/.exec(path);
    if (blob && this.blobs.has(blob[1])) return new Response(this.blobs.get(blob[1]), { status: 200 });
    return json(404, { message: "Not Found" });
  }) as typeof fetch;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const repoFile: RepoFile = { owner: "someone", repo: "flitunes-library", branch: "main", path: "library.json" };

function setup() {
  const github = new FakeGitHub();
  const publicFile = { file: null as LibraryFile | null };
  const publicSource: LibrarySource = { fetchFile: async () => publicFile.file };
  const storage = new Map<string, string>();
  const store = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  };
  const source = new GitHubSource(repoFile, publicSource, store, github.fetch);
  return { github, publicFile, source };
}

describe("GitHubSource", () => {
  it("reads the public file and asks for a token to save, until it has one", async () => {
    const { publicFile, source } = setup();
    publicFile.file = file("2026-10-01T00:00:00.000Z");
    expect(source.hasToken).toBe(false);
    expect(await source.fetchFile()).toEqual(publicFile.file);
    await expect(source.saveFile(file("2026-10-02T00:00:00.000Z"), 1)).rejects.toBeInstanceOf(TokenNeeded);
  });

  it("only keeps a token that can write to the repo", async () => {
    const { github, source } = setup();
    await expect(source.setToken("bad")).rejects.toThrow(/rejected/);
    github.canPush = false;
    await expect(source.setToken("good")).rejects.toThrow(/can't write/);
    expect(source.hasToken).toBe(false);
    github.canPush = true;
    await source.setToken(" good ");
    expect(source.hasToken).toBe(true);
    source.forgetToken();
    expect(source.hasToken).toBe(false);
  });

  it("reads the file through the API and commits on top of it", async () => {
    const { github, source } = setup();
    github.write(serializeLibraryFile(file("2026-10-01T00:00:00.000Z", "Café Bleu")));
    await source.setToken("good");
    expect((await source.fetchFile())?.albums[0].title).toBe("Café Bleu");

    await source.saveFile(file("2026-10-02T00:00:00.000Z", "Kind of Blue — Legacy"), 3);
    await source.saveFile(file("2026-10-03T00:00:00.000Z"), 1);
    expect(github.commits).toEqual([
      { message: "Update library (3 changes)", branch: "main" },
      { message: "Update library (1 change)", branch: "main" },
    ]);
    expect(parseLibraryFile(github.content!).exportedAt).toBe("2026-10-03T00:00:00.000Z");
  });

  it("reports a conflict when the file changed, or wasn't read through the API", async () => {
    const { github, source } = setup();
    github.write(serializeLibraryFile(file("2026-10-01T00:00:00.000Z")));
    await source.setToken("good");
    // Not fetched yet: no sha to commit on top of.
    await expect(source.saveFile(file("2026-10-02T00:00:00.000Z"), 1)).rejects.toBeInstanceOf(SaveConflict);

    await source.fetchFile();
    github.write(serializeLibraryFile(file("2026-10-02T00:00:00.000Z"))); // another machine
    await expect(source.saveFile(file("2026-10-03T00:00:00.000Z"), 1)).rejects.toBeInstanceOf(SaveConflict);

    await source.fetchFile();
    await source.saveFile(file("2026-10-03T00:00:00.000Z"), 1);
    expect(github.commits).toHaveLength(1);
  });

  it("creates the file when there is none", async () => {
    const { github, source } = setup();
    await source.setToken("good");
    expect(await source.fetchFile()).toBeNull();
    await source.saveFile(file("2026-10-01T00:00:00.000Z"), 1);
    expect(github.commits).toHaveLength(1);
  });

  it("forgets a revoked token", async () => {
    const { github, publicFile, source } = setup();
    publicFile.file = file("2026-10-01T00:00:00.000Z");
    await source.setToken("good");
    github.token = "rotated";
    expect(await source.fetchFile()).toEqual(publicFile.file);
    expect(source.hasToken).toBe(false);

    await source.setToken("rotated");
    github.token = "rotated again";
    await expect(source.saveFile(file("2026-10-02T00:00:00.000Z"), 1)).rejects.toThrow(/rejected the saved token/);
    expect(source.hasToken).toBe(false);
  });
});
