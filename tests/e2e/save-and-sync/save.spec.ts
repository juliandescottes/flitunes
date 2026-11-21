import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
  album,
  answerConfirm,
  assertDisplay,
  assertRating,
  assertShownAlbums,
  assertUnsavedChanges,
  libraryFile,
  openApp,
  rateInList,
  textFile,
} from "../testutils.ts";

const LIBRARY = {
  albums: [album({ title: "Moon Safari", artists: ["Air"] }), album({ title: "Blue Train", artists: ["John Coltrane"] })],
};

/** library.json as it was last loaded: the local copy is based on it. */
const BASE = libraryFile(LIBRARY, "2026-01-01T00:00:00.000Z");

/** library.json as saved later from another browser, with another album. */
const NEWER = libraryFile(
  { albums: [...LIBRARY.albums, album({ title: "Dummy", artists: ["Portishead"] })] },
  "2026-02-01T00:00:00.000Z",
);

function saveButton(page: Page) {
  return page.getByRole("button", { name: "Save", exact: true });
}

/** Rating of an album in a saved library file. */
function savedRating(file: { albums: { title: string; rating: number | null }[] }, title: string) {
  return file.albums.find((a) => a.title === title)?.rating;
}

test("Changes are kept across reloads and counted until saved", { tag: ["@save-and-sync.local-copy", "@save-and-sync.unsaved"] }, async ({ page }) => {
  await openApp(page, BASE);
  await assertUnsavedChanges(page, 0);
  await assertDisplay(page, "FliTunes", "All changes saved");

  await rateInList(page, "Moon Safari", 4);
  await assertUnsavedChanges(page, 1);
  // Rating selects nothing: the display shows the count.
  await assertDisplay(page, "FliTunes", "1 unsaved change");

  await rateInList(page, "Blue Train", 5);
  await assertUnsavedChanges(page, 2);
  await assertDisplay(page, "FliTunes", "2 unsaved changes");

  await page.reload();
  await assertRating(page, "Moon Safari", 4);
  await assertRating(page, "Blue Train", 5);
  await assertUnsavedChanges(page, 2);
});

test("Save writes library.json, and is only enabled with unsaved changes", { tag: ["@save-and-sync.save"] }, async ({ page }) => {
  const { saved } = await openApp(page, BASE);

  // Nothing to save: the button is disabled and ⌘S does nothing.
  await expect(saveButton(page)).toBeDisabled();
  await page.keyboard.press("ControlOrMeta+s");

  await rateInList(page, "Moon Safari", 4);
  await expect(saveButton(page)).toBeEnabled();
  await saveButton(page).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(savedRating(saved[0], "Moon Safari")).toBe(4);
  await assertUnsavedChanges(page, 0);
  await assertDisplay(page, "FliTunes", "All changes saved");
  await expect(saveButton(page)).toBeDisabled();

  // ⌘S.
  await rateInList(page, "Blue Train", 2);
  await page.keyboard.press("ControlOrMeta+s");
  await expect.poll(() => saved.length).toBe(2);
  expect(savedRating(saved[1], "Blue Train")).toBe(2);
  await assertUnsavedChanges(page, 0);
});

test("Export downloads library.json, and counts as saved", { tag: ["@save-and-sync.export"] }, async ({ page }) => {
  const { saved } = await openApp(page, BASE);
  await rateInList(page, "Moon Safari", 3);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("library.json");
  const file = JSON.parse(await readFile(await (await download).path(), "utf8"));
  expect(file.albums.map((a: { title: string }) => a.title).sort()).toEqual(["Blue Train", "Moon Safari"]);
  expect(savedRating(file, "Moon Safari")).toBe(3);

  await assertUnsavedChanges(page, 0);
  // Downloaded only: the dev server's file wasn't written.
  expect(saved).toEqual([]);
});

test("Import replaces the library with a file, after asking", { tag: ["@save-and-sync.import"] }, async ({ page }) => {
  await openApp(page, BASE);
  const other = libraryFile({ albums: [album({ title: "Homogenic", artists: ["Björk"] })] });

  // Cancelled: nothing changes.
  let question = answerConfirm(page, false);
  await importFile(page, textFile("library.json", JSON.stringify(other)));
  expect(await question).toBe("Replace the whole local library with this file?");
  await assertShownAlbums(page, ["Moon Safari", "Blue Train"]);

  question = answerConfirm(page);
  await importFile(page, textFile("library.json", JSON.stringify(other)));
  await question;
  await assertShownAlbums(page, ["Homogenic"]);
});

test("A file that isn't a library is refused, with the reason in a banner", { tag: ["@save-and-sync.import", "@save-and-sync.errors"] }, async ({ page }) => {
  await openApp(page, BASE);

  const question = answerConfirm(page);
  await importFile(page, textFile("library.json", JSON.stringify({ schemaVersion: 2 })));
  await question;
  await expect(page.getByText("Unsupported schemaVersion: 2")).toBeVisible();
  await assertShownAlbums(page, ["Moon Safari", "Blue Train"]);

  await page.getByRole("button", { name: "OK" }).click();
  await expect(page.getByText("Unsupported schemaVersion: 2")).toBeHidden();
});

test("A newer library.json replaces a local copy without changes", { tag: ["@save-and-sync.newer-file"] }, async ({ page }) => {
  const { serve } = await openApp(page, BASE);
  await assertShownAlbums(page, ["Moon Safari", "Blue Train"]);

  serve(NEWER);
  await page.reload();
  await assertShownAlbums(page, ["Moon Safari", "Blue Train", "Dummy"]);
  await assertUnsavedChanges(page, 0);
});

test("With unsaved changes, a newer library.json can replace them", { tag: ["@save-and-sync.conflict"] }, async ({ page }) => {
  const { serve } = await openApp(page, BASE);
  await rateInList(page, "Moon Safari", 4);

  serve(NEWER);
  await page.reload();
  await expect(page.getByText("library.json is newer than your local copy, but you have 1 unsaved changes.")).toBeVisible();
  // The local copy shows until a choice is made.
  await assertShownAlbums(page, ["Moon Safari", "Blue Train"]);

  await page.getByRole("button", { name: "Load library.json" }).click();
  await expect(page.getByText("library.json is newer than your local copy")).toBeHidden();
  await assertShownAlbums(page, ["Moon Safari", "Blue Train", "Dummy"]);
  await assertRating(page, "Moon Safari", 0);
  await assertUnsavedChanges(page, 0);
});

test("With unsaved changes, the local copy can be kept over a newer library.json", { tag: ["@save-and-sync.conflict"] }, async ({ page }) => {
  const { serve, saved } = await openApp(page, BASE);
  await rateInList(page, "Moon Safari", 4);

  serve(NEWER);
  await page.reload();
  await page.getByRole("button", { name: "Keep Local Copy" }).click();
  await expect(page.getByText("library.json is newer than your local copy")).toBeHidden();
  await assertShownAlbums(page, ["Moon Safari", "Blue Train"]);
  await assertUnsavedChanges(page, 1);

  // Save overwrites library.json with the local copy.
  await saveButton(page).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].albums.map((a) => a.title).sort()).toEqual(["Blue Train", "Moon Safari"]);
  expect(savedRating(saved[0], "Moon Safari")).toBe(4);
});

/** Clicks Import and chooses a file. */
async function importFile(page: Page, file: ReturnType<typeof textFile>) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await (await chooser).setFiles(file);
}
