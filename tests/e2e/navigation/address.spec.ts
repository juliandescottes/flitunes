import { expect, test, type Page } from "@playwright/test";
import {
  album,
  assertColumnPick,
  assertSelectedSource,
  assertShownAlbums,
  clickAlbum,
  genre,
  openApp,
  pickInColumn,
  searchField,
  searchFor,
  selectSource,
  sortBy,
  switchView,
} from "../testutils.ts";

const JAZZ = genre("Jazz");
const ROCK = genre("Rock");

// Sorted by artist: John Coltrane, Joni Mitchell, Miles Davis.
const LIBRARY = {
  genres: [JAZZ, ROCK],
  albums: [
    album({ title: "Kind of Blue", artists: ["Miles Davis"], genres: [JAZZ.id], tags: ["vinyl"] }),
    album({ title: "Blue Train", artists: ["John Coltrane"], genres: [JAZZ.id], tags: ["vinyl"] }),
    album({ title: "Giant Steps", artists: ["John Coltrane"], genres: [JAZZ.id] }),
    album({ title: "Blue", artists: ["Joni Mitchell"], genres: [ROCK.id], tags: ["vinyl"] }),
  ],
};

/** The part of the address after the page: "" for the plain library. */
function addressSuffix(page: Page): string {
  return new URL(page.url()).hash;
}

async function assertAddress(page: Page, suffix: string) {
  await expect.poll(() => addressSuffix(page)).toBe(suffix);
}

test("The address holds the source, the picks and the search, and a reload keeps them", { tag: ["@navigation.address"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await assertAddress(page, "");

  // The vinyl playlist, jazz albums, searching for "blue".
  await selectSource(page, "vinyl");
  await pickInColumn(page, "Genres", "Jazz");
  await searchFor(page, "blue");
  await assertAddress(page, "#/playlist/vinyl?genre=jazz&q=blue");

  // The view, the sort and the selection stay out of it.
  await switchView(page, "Grid");
  await switchView(page, "List");
  await sortBy(page, "Name");
  await clickAlbum(page, "Kind of Blue");
  await assertAddress(page, "#/playlist/vinyl?genre=jazz&q=blue");

  await page.reload();
  await assertSelectedSource(page, "vinyl");
  await assertColumnPick(page, "Genres", "Jazz");
  await expect(searchField(page)).toHaveValue("blue");
  await assertShownAlbums(page, ["Blue Train", "Kind of Blue"]);

  // Back to the plain library: no suffix. (Selecting a source keeps the search.)
  await selectSource(page, "Music");
  await assertAddress(page, "#/music?q=blue");
  await searchFor(page, "");
  await assertAddress(page, "");
});

test("Opening an address shows that place", { tag: ["@navigation.address"] }, async ({ page }) => {
  await openApp(page, LIBRARY, "/#/music?artist=John%20Coltrane&album=Blue%20Train");

  await assertSelectedSource(page, "Music");
  await assertColumnPick(page, "Artists", "John Coltrane");
  await assertColumnPick(page, "Albums", "Blue Train");
  await assertShownAlbums(page, ["Blue Train"]);
});

test("Back and Forward go through the places, a search being one step", { tag: ["@navigation.back-forward"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  // Jazz, then John Coltrane, then a search typed letter by letter.
  await pickInColumn(page, "Genres", "Jazz");
  await pickInColumn(page, "Artists", "John Coltrane");
  await searchField(page).pressSequentially("blue");
  await assertShownAlbums(page, ["Blue Train"]);

  // Back: the whole search at once.
  await page.goBack();
  await expect(searchField(page)).toHaveValue("");
  await assertShownAlbums(page, ["Blue Train", "Giant Steps"]);

  // Back: no artist picked.
  await page.goBack();
  await assertColumnPick(page, "Artists", "All (2 Artists)");
  await assertColumnPick(page, "Genres", "Jazz");

  // Back: the plain library.
  await page.goBack();
  await assertColumnPick(page, "Genres", "All (2 Genres)");
  await assertShownAlbums(page, ["Blue Train", "Giant Steps", "Blue", "Kind of Blue"]);

  // Forward twice: Jazz, then John Coltrane.
  await page.goForward();
  await assertColumnPick(page, "Genres", "Jazz");
  await page.goForward();
  await assertColumnPick(page, "Artists", "John Coltrane");
  await assertShownAlbums(page, ["Blue Train", "Giant Steps"]);
});

test("Back goes to the source shown before", { tag: ["@navigation.back-forward"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  await selectSource(page, "vinyl");
  await selectSource(page, "Recently Added");
  await page.goBack();
  await assertSelectedSource(page, "vinyl");
  await assertShownAlbums(page, ["Blue Train", "Blue", "Kind of Blue"]);
});

test("An address that isn't recognised shows Music", { tag: ["@navigation.unknown"] }, async ({ page }) => {
  await openApp(page, LIBRARY, "/#/somewhere/else");

  await assertSelectedSource(page, "Music");
  await assertShownAlbums(page, ["Blue Train", "Giant Steps", "Blue", "Kind of Blue"]);
});
