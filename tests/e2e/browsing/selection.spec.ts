import { test } from "@playwright/test";
import {
  album,
  assertGridAlbums,
  assertGridSelection,
  assertSelectedAlbums,
  assertShownAlbums,
  clickAlbum,
  clickGridAlbum,
  focusMainView,
  openApp,
  sortBy,
  switchView,
} from "../testutils.ts";

// Sorted by artist: Air, Can, Coltrane, Eno, Fela Kuti.
const LIBRARY = {
  albums: [
    album({ title: "Moon Safari", artists: ["Air"], year: 1998, rating: 3 }),
    album({ title: "Ege Bamyasi", artists: ["Can"], year: 1972, rating: 5 }),
    album({ title: "Blue Train", artists: ["John Coltrane"], year: 1957 }),
    album({ title: "Apollo", artists: ["Brian Eno"], year: 1983, rating: 4 }),
    album({ title: "Zombie", artists: ["Fela Kuti"], year: 1976 }),
  ],
};

test("Click selects one album, Cmd-click toggles, Shift-click selects a range", { tag: ["@browsing.select-click"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await assertShownAlbums(page, ["Moon Safari", "Apollo", "Ege Bamyasi", "Zombie", "Blue Train"]);

  await clickAlbum(page, "Apollo");
  await assertSelectedAlbums(page, ["Apollo"]);

  await clickAlbum(page, "Zombie");
  await assertSelectedAlbums(page, ["Zombie"]);

  // Cmd adds to the selection, or removes from it.
  await clickAlbum(page, "Moon Safari", ["ControlOrMeta"]);
  await assertSelectedAlbums(page, ["Moon Safari", "Zombie"]);
  await clickAlbum(page, "Zombie", ["ControlOrMeta"]);
  await assertSelectedAlbums(page, ["Moon Safari"]);

  // Shift selects from the last album clicked without Shift (Zombie, even
  // though it was just removed) to the clicked one.
  await clickAlbum(page, "Apollo", ["Shift"]);
  await assertSelectedAlbums(page, ["Apollo", "Ege Bamyasi", "Zombie"]);

  // Another Shift-click starts from the same album.
  await clickAlbum(page, "Blue Train", ["Shift"]);
  await assertSelectedAlbums(page, ["Zombie", "Blue Train"]);
});

test("The arrow keys move the selection in the list, Shift extends it", { tag: ["@browsing.select-keyboard"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  // With nothing selected, Down selects the first album.
  await focusMainView(page);
  await page.keyboard.press("ArrowDown");
  await assertSelectedAlbums(page, ["Moon Safari"]);

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await assertSelectedAlbums(page, ["Ege Bamyasi"]);

  await page.keyboard.press("ArrowUp");
  await assertSelectedAlbums(page, ["Apollo"]);

  // Shift extends from the last album selected without Shift.
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Shift+ArrowDown");
  await assertSelectedAlbums(page, ["Apollo", "Ege Bamyasi", "Zombie"]);

  // Down stops at the last album.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await assertSelectedAlbums(page, ["Blue Train"]);
});

test("In the grid, left and right move by one album, up and down by one row", { tag: ["@browsing.select-keyboard"] }, async ({ page }) => {
  // 800 pixels wide: three albums per row.
  await page.setViewportSize({ width: 800, height: 800 });
  await openApp(page, LIBRARY);
  await switchView(page, "Grid");
  await assertGridAlbums(page, ["Moon Safari / Air", "Apollo / Brian Eno", "Ege Bamyasi / Can", "Zombie / Fela Kuti", "Blue Train / John Coltrane"]);

  await clickGridAlbum(page, "Moon Safari");
  await page.keyboard.press("ArrowRight");
  await assertGridSelection(page, "Apollo");

  await page.keyboard.press("ArrowLeft");
  await assertGridSelection(page, "Moon Safari");

  // Down: the album below, on the second row.
  await page.keyboard.press("ArrowDown");
  await assertGridSelection(page, "Zombie");

  await page.keyboard.press("ArrowUp");
  await assertGridSelection(page, "Moon Safari");
});

test("Cmd+A selects every album shown", { tag: ["@browsing.select-all"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await clickAlbum(page, "Apollo");

  await page.keyboard.press("ControlOrMeta+a");
  await assertSelectedAlbums(page, ["Moon Safari", "Apollo", "Ege Bamyasi", "Zombie", "Blue Train"]);
});

test("Typing letters selects the first album whose sorted column starts with them", { tag: ["@browsing.type-ahead"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await focusMainView(page);

  // Sorted by artist: "f" is Fela Kuti.
  await page.keyboard.type("f");
  await assertSelectedAlbums(page, ["Zombie"]);

  // Right after, "j" adds up to "fj", which matches nothing: the selection stays.
  await page.keyboard.type("j");
  await assertSelectedAlbums(page, ["Zombie"]);

  // After a second, typing starts over: "j" is John Coltrane.
  await page.waitForTimeout(1100);
  await page.keyboard.type("j");
  await assertSelectedAlbums(page, ["Blue Train"]);

  // Sorted by rating, the name is matched: "b" is Blue Train, not Brian Eno.
  await sortBy(page, "Rating");
  await focusMainView(page);
  await page.waitForTimeout(1100);
  await page.keyboard.type("b");
  await assertSelectedAlbums(page, ["Blue Train"]);
});
