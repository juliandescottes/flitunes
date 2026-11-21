import { expect, test } from "@playwright/test";
import {
  album,
  albumMenu,
  answerConfirm,
  assertSelectedAlbums,
  assertShownAlbums,
  assertSources,
  assertUnsavedChanges,
  clickAlbum,
  daysAgo,
  focusMainView,
  openApp,
  selectSource,
} from "../testutils.ts";

const LIBRARY = {
  albums: [
    album({ title: "Moon Safari", artists: ["Air"], tags: ["road trip"] }),
    // Waiting for review, imported last week.
    album({ title: "Homogenic", artists: ["Björk"], tags: ["triage"], addedAt: daysAgo(7) }),
    album({ title: "Dummy", artists: ["Portishead"], tags: ["triage", "road trip"], addedAt: daysAgo(7) }),
    album({ title: "OK Computer", artists: ["Radiohead"], tags: ["triage"], addedAt: daysAgo(7) }),
  ],
};

/** The Accept or Delete button of the triage bar. */
function triageButton(page: import("@playwright/test").Page, name: "Accept" | "Delete") {
  return page.getByRole("button", { name, exact: true });
}

test(
  "Albums waiting for review only show in Triage, with their count",
  { tag: ["@triage.source", "@browsing.music"] },
  async ({ page }) => {
    await openApp(page, LIBRARY);

    // "triage" isn't a playlist; Dummy's road trip playlist doesn't show it.
    await assertSources(page, ["Music", "Recently Added", "Triage 3", "road trip"]);
    await assertShownAlbums(page, ["Moon Safari"]);
    await selectSource(page, "Recently Added");
    await assertShownAlbums(page, []);
    await selectSource(page, "road trip");
    await assertShownAlbums(page, ["Moon Safari"]);

    await selectSource(page, "Triage");
    await assertShownAlbums(page, ["Homogenic", "Dummy", "OK Computer"]);
  },
);

test("Without albums to review, there is no Triage", { tag: ["@triage.source"] }, async ({ page }) => {
  await openApp(page, { albums: [album({ title: "Moon Safari", artists: ["Air"] })] });

  await assertSources(page, ["Music", "Recently Added"]);
});

test("The triage bar's buttons need a selection", { tag: ["@triage.bar"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  // Not in Music.
  await expect(page.getByText("Imported albums waiting for review.")).toBeHidden();

  await selectSource(page, "Triage");
  await expect(
    page.getByText("Imported albums waiting for review. Accept keeps them in your library, Delete removes them."),
  ).toBeVisible();
  await expect(triageButton(page, "Accept")).toBeDisabled();
  await expect(triageButton(page, "Delete")).toBeDisabled();

  await clickAlbum(page, "Dummy");
  await expect(triageButton(page, "Accept")).toBeEnabled();
  await expect(triageButton(page, "Delete")).toBeEnabled();
});

test("Accepting moves albums to Music, keeping their playlists, and selects the next one", { tag: ["@triage.accept"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await selectSource(page, "Triage");

  // The Accept button.
  await clickAlbum(page, "Dummy");
  await triageButton(page, "Accept").click();
  await assertShownAlbums(page, ["Homogenic", "OK Computer"]);
  await assertSelectedAlbums(page, ["OK Computer"]);
  await assertSources(page, ["Music", "Recently Added", "Triage 2", "road trip"]);
  await assertUnsavedChanges(page, 1);

  // ⌘Enter in the main view (not on the Accept button), on the last album:
  // the one before it is selected.
  await focusMainView(page);
  await page.keyboard.press("ControlOrMeta+Enter");
  await assertShownAlbums(page, ["Homogenic"]);
  await assertSelectedAlbums(page, ["Homogenic"]);

  // Dummy and OK Computer are in Music, and Dummy still in road trip.
  await selectSource(page, "Music");
  await assertShownAlbums(page, ["Moon Safari", "Dummy", "OK Computer"]);
  await selectSource(page, "road trip");
  await assertShownAlbums(page, ["Moon Safari", "Dummy"]);
});

test("The album menu accepts the selected albums", { tag: ["@triage.accept"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await selectSource(page, "Triage");

  // ⌘-click adds OK Computer to the selection.
  await clickAlbum(page, "Homogenic");
  await clickAlbum(page, "OK Computer", ["ControlOrMeta"]);
  await albumMenu(page, "OK Computer", "Accept 2 Albums");
  await assertShownAlbums(page, ["Dummy"]);
  // As one change.
  await assertUnsavedChanges(page, 1);

  await albumMenu(page, "Dummy", "Accept into Library");
  await selectSource(page, "Music");
  await assertShownAlbums(page, ["Moon Safari", "Homogenic", "Dummy", "OK Computer"]);
});

test("Delete in the triage bar asks first", { tag: ["@triage.delete"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await selectSource(page, "Triage");
  await clickAlbum(page, "Homogenic");

  // Cancelled: nothing changes.
  let question = answerConfirm(page, false);
  await triageButton(page, "Delete").click();
  expect(await question).toBe("Remove “Homogenic” from your library?");
  await assertShownAlbums(page, ["Homogenic", "Dummy", "OK Computer"]);

  question = answerConfirm(page);
  await triageButton(page, "Delete").click();
  await question;
  await assertShownAlbums(page, ["Dummy", "OK Computer"]);
  await assertSelectedAlbums(page, ["Dummy"]);

  // Gone from the library, not accepted into Music.
  await selectSource(page, "Music");
  await assertShownAlbums(page, ["Moon Safari"]);
});

test("Once everything is reviewed, Triage stays until another source is picked", { tag: ["@triage.done"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await selectSource(page, "Triage");

  // Select all three and accept them.
  await clickAlbum(page, "Homogenic");
  await clickAlbum(page, "OK Computer", ["Shift"]);
  await triageButton(page, "Accept").click();
  await expect(page.getByText("Nothing left to review.")).toBeVisible();
  await assertSources(page, ["Music", "Recently Added", "Triage", "road trip"]);

  await selectSource(page, "Music");
  await assertSources(page, ["Music", "Recently Added", "road trip"]);
});
