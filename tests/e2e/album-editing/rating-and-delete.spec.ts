import { expect, test } from "@playwright/test";
import {
  album,
  albumMenu,
  answerConfirm,
  assertRating,
  assertSelectedAlbums,
  assertShownAlbums,
  albumCell,
  clickAlbum,
  focusMainView,
  infoWindow,
  openApp,
  openGetInfo,
  rateInList,
} from "../testutils.ts";

// Sorted by artist: Air, Can, Coltrane, Eno.
const LIBRARY = {
  albums: [
    album({ title: "Moon Safari", artists: ["Air"] }),
    album({ title: "Ege Bamyasi", artists: ["Can"], rating: 2 }),
    album({ title: "Blue Train", artists: ["John Coltrane"] }),
    album({ title: "Apollo", artists: ["Brian Eno"] }),
  ],
};

test("Clicking a star rates the album, clicking its rating clears it", { tag: ["@album-editing.rating"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await assertRating(page, "Moon Safari", 0);

  await rateInList(page, "Moon Safari", 4);
  await assertRating(page, "Moon Safari", 4);

  // Rating doesn't select the album.
  await assertSelectedAlbums(page, []);

  await rateInList(page, "Ege Bamyasi", 5);
  await assertRating(page, "Ege Bamyasi", 5);

  // Clicking the current rating clears it.
  await rateInList(page, "Moon Safari", 4);
  await assertRating(page, "Moon Safari", 0);

  // Get Info shows the new rating, and it survives a reload.
  await page.reload();
  await assertRating(page, "Ege Bamyasi", 5);
  await clickAlbum(page, "Ege Bamyasi");
  const info = await openGetInfo(page);
  await expect(info.getByRole("radio", { name: "5 stars" })).toHaveAttribute("aria-checked", "true");
});

test("Unrated albums show their empty stars while selected", { tag: ["@album-editing.rating"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  const firstStar = albumCell(page, "Moon Safari", "Rating").getByRole("radio", { name: "1 star" });
  await expect(firstStar).toBeHidden();

  await clickAlbum(page, "Moon Safari");
  await expect(firstStar).toBeVisible();
});

test("Delete removes the selected album after confirming, and selects the next one", { tag: ["@album-editing.delete"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await assertShownAlbums(page, ["Moon Safari", "Apollo", "Ege Bamyasi", "Blue Train"]);
  await clickAlbum(page, "Apollo");

  // Cancel keeps it.
  let question = answerConfirm(page, false);
  await page.keyboard.press("Delete");
  expect(await question).toBe("Remove “Apollo” from your library?");
  await assertShownAlbums(page, ["Moon Safari", "Apollo", "Ege Bamyasi", "Blue Train"]);

  // OK removes it, and the next album is selected.
  question = answerConfirm(page);
  await page.keyboard.press("Delete");
  await question;
  await assertShownAlbums(page, ["Moon Safari", "Ege Bamyasi", "Blue Train"]);
  await assertSelectedAlbums(page, ["Ege Bamyasi"]);

  // Backspace works too. After the last album, the one before is selected.
  await clickAlbum(page, "Blue Train");
  question = answerConfirm(page);
  await page.keyboard.press("Backspace");
  await question;
  await assertShownAlbums(page, ["Moon Safari", "Ege Bamyasi"]);
  await assertSelectedAlbums(page, ["Ege Bamyasi"]);

  // Gone for good.
  await page.reload();
  await assertShownAlbums(page, ["Moon Safari", "Ege Bamyasi"]);
});

test("The context menu and Get Info delete albums too", { tag: ["@album-editing.delete"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  // Context menu on a selection of two.
  await clickAlbum(page, "Moon Safari");
  await clickAlbum(page, "Apollo", ["Shift"]);
  let question = answerConfirm(page);
  await albumMenu(page, "Apollo", "Delete 2 Albums");
  expect(await question).toBe("Remove these 2 albums from your library?");
  await assertShownAlbums(page, ["Ege Bamyasi", "Blue Train"]);
  await assertSelectedAlbums(page, ["Ege Bamyasi"]);

  // Get Info's Delete button.
  const info = await openGetInfo(page);
  question = answerConfirm(page);
  await info.getByRole("button", { name: "Delete" }).click();
  expect(await question).toBe("Remove “Ege Bamyasi” from your library?");
  await expect(infoWindow(page)).toBeHidden();
  await assertShownAlbums(page, ["Blue Train"]);
  await assertSelectedAlbums(page, ["Blue Train"]);

  // Delete with the focus in the main view but nothing selected does nothing.
  await focusMainView(page);
  await clickAlbum(page, "Blue Train", ["ControlOrMeta"]);
  await page.keyboard.press("Delete");
  await assertShownAlbums(page, ["Blue Train"]);
});
