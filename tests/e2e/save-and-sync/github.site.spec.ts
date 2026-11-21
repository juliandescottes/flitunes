// Saving from the site: library.json is committed to the data repository on
// GitHub (faked, see ../github.ts).

import { expect, test, type Page } from "@playwright/test";
import { FakeGitHub, keepGitHubToken, openSite, OTHER_REPO_TOKEN, READ_TOKEN, WRITE_TOKEN } from "../github.ts";
import { album, assertRating, assertShownAlbums, assertUnsavedChanges, libraryFile, rateInList, sheet } from "../testutils.ts";

const LIBRARY = libraryFile(
  { albums: [album({ title: "Moon Safari", artists: ["Air"] }), album({ title: "Blue Train", artists: ["John Coltrane"] })] },
  "2026-01-01T00:00:00.000Z",
);

function saveButton(page: Page) {
  return page.getByRole("button", { name: "Save", exact: true });
}

/** Types a token in the GitHub token sheet and submits it. */
async function enterToken(page: Page, token: string) {
  await sheet(page).getByLabel("Token").fill(token);
  await sheet(page).getByRole("button", { name: "Save" }).click();
}

/** Right-clicks Save and returns its menu. */
async function saveMenu(page: Page) {
  await saveButton(page).click({ button: "right" });
  return page.getByRole("menu");
}

test("The first Save asks for a token, checks it, then commits", { tag: ["@save-and-sync.github-token", "@save-and-sync.github-commit"] }, async ({ page }) => {
  const github = new FakeGitHub(LIBRARY);
  await openSite(page, github);
  await rateInList(page, "Moon Safari", 4);

  await saveButton(page).click();
  await expect(sheet(page).getByRole("heading", { name: "Save to GitHub" })).toBeVisible();
  await expect(sheet(page)).toContainText("Save commits library.json to test-owner/test-library.");

  // Refused tokens, each with its reason.
  await enterToken(page, "github_pat_typo");
  await expect(sheet(page).getByText("GitHub rejected this token.")).toBeVisible();
  await enterToken(page, OTHER_REPO_TOKEN);
  await expect(sheet(page).getByText("This token has no access to test-owner/test-library.")).toBeVisible();
  await enterToken(page, READ_TOKEN);
  await expect(sheet(page).getByText("This token can't write to test-owner/test-library (Contents: Read and write).")).toBeVisible();
  expect(github.commits).toEqual([]);

  // Accepted: the save goes on.
  await enterToken(page, WRITE_TOKEN);
  await expect(sheet(page)).toBeHidden();
  await expect.poll(() => github.commits.length).toBe(1);
  expect(github.commits[0].message).toBe("Update library (1 change)");
  expect(github.commits[0].file.albums.find((a) => a.title === "Moon Safari")?.rating).toBe(4);
  await assertUnsavedChanges(page, 0);

  // The token is kept: the next Save commits right away, here two changes.
  await rateInList(page, "Blue Train", 5);
  await rateInList(page, "Moon Safari", 2);
  await saveButton(page).click();
  await expect.poll(() => github.commits.length).toBe(2);
  await expect(sheet(page)).toBeHidden();
  expect(github.commits[1].message).toBe("Update library (2 changes)");
});

test("Cancelling the token sheet saves nothing", { tag: ["@save-and-sync.github-token"] }, async ({ page }) => {
  const github = new FakeGitHub(LIBRARY);
  await openSite(page, github);
  await rateInList(page, "Moon Safari", 4);

  await saveButton(page).click();
  await sheet(page).getByRole("button", { name: "Cancel" }).click();
  await expect(sheet(page)).toBeHidden();
  await assertUnsavedChanges(page, 1);
  expect(github.commits).toEqual([]);
});

test("Right-clicking Save changes or forgets the token", { tag: ["@save-and-sync.github-token-menu"] }, async ({ page }) => {
  const github = new FakeGitHub(LIBRARY);
  await openSite(page, github);
  // Save only takes clicks while there is something to save.
  await rateInList(page, "Moon Safari", 4);

  // No token yet: nothing to forget.
  let menu = await saveMenu(page);
  await expect(menu.getByRole("menuitem")).toHaveText(["Change GitHub Token…", "Forget GitHub Token"]);
  await expect(menu.getByRole("menuitem", { name: "Forget GitHub Token" })).toBeDisabled();

  // Change GitHub Token… asks for one, then saves.
  await menu.getByRole("menuitem", { name: "Change GitHub Token…" }).click();
  await enterToken(page, WRITE_TOKEN);
  await expect(sheet(page)).toBeHidden();
  await expect.poll(() => github.commits.length).toBe(1);

  // Forgotten: the next Save asks again.
  await rateInList(page, "Blue Train", 3);
  menu = await saveMenu(page);
  await menu.getByRole("menuitem", { name: "Forget GitHub Token" }).click();
  await saveButton(page).click();
  await expect(sheet(page).getByRole("heading", { name: "Save to GitHub" })).toBeVisible();
});

test("A token GitHub no longer accepts is asked for again", { tag: ["@save-and-sync.github-rejected"] }, async ({ page }) => {
  const github = new FakeGitHub(LIBRARY);
  await keepGitHubToken(page, WRITE_TOKEN);
  await openSite(page, github);
  await rateInList(page, "Moon Safari", 4);

  // Revoked since the page loaded.
  github.tokens.delete(WRITE_TOKEN);
  await saveButton(page).click();
  await expect(sheet(page).getByText("GitHub rejected the saved token. Paste a new one.")).toBeVisible();
  expect(github.commits).toEqual([]);
});

test("Save shows the conflict when library.json changed on GitHub", { tag: ["@save-and-sync.github-conflict"] }, async ({ page }) => {
  const github = new FakeGitHub(LIBRARY);
  await keepGitHubToken(page, WRITE_TOKEN);
  await openSite(page, github);
  await rateInList(page, "Moon Safari", 4);

  // Saved from another browser meanwhile, with another album.
  github.commitElsewhere(
    libraryFile({ albums: [...LIBRARY.albums, album({ title: "Dummy", artists: ["Portishead"] })] }, "2026-02-01T00:00:00.000Z"),
  );
  await saveButton(page).click();
  await expect(page.getByText("library.json is newer than your local copy, but you have 1 unsaved changes.")).toBeVisible();
  expect(github.commits).toEqual([]);

  // Loading it drops the rating and brings the album.
  await page.getByRole("button", { name: "Load library.json" }).click();
  await assertShownAlbums(page, ["Moon Safari", "Blue Train", "Dummy"]);
  await assertRating(page, "Moon Safari", 0);
  await assertUnsavedChanges(page, 0);
});
