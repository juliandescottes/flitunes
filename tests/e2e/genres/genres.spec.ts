import { expect, test, type Page } from "@playwright/test";
import {
  album,
  albumCell,
  answerConfirm,
  assertColumn,
  assertColumnPick,
  assertShownAlbums,
  assertUnsavedChanges,
  column,
  genre,
  openApp,
  pickInColumn,
} from "../testutils.ts";

const ELECTRONIC = genre("Electronic");
const ELECTRONICA = genre("Electronica");
const JAZZ = genre("Jazz");
const TRIP_HOP = genre("Trip Hop");

const LIBRARY = {
  genres: [ELECTRONIC, ELECTRONICA, JAZZ, TRIP_HOP],
  albums: [
    album({ title: "Moon Safari", artists: ["Air"], genres: [ELECTRONIC.id] }),
    // Filed under both Electronica and Electronic.
    album({ title: "Selected Ambient Works 85-92", artists: ["Aphex Twin"], genres: [ELECTRONICA.id, ELECTRONIC.id] }),
    album({ title: "Music Has the Right to Children", artists: ["Boards of Canada"], genres: [ELECTRONICA.id] }),
    album({ title: "Blue Train", artists: ["John Coltrane"], genres: [JAZZ.id] }),
    album({ title: "Dummy", artists: ["Portishead"], genres: [TRIP_HOP.id, ELECTRONIC.id] }),
  ],
};

/** A genre's entry in the Genres column. */
function genreEntry(page: Page, name: string) {
  return column(page, "Genres").getByRole("option", { name, exact: true });
}

/** The field a genre is renamed in. */
function renameField(page: Page) {
  return column(page, "Genres").getByRole("textbox", { name: "Genre name" });
}

/** Right-clicks a genre and picks an item of its menu. */
async function genreMenu(page: Page, name: string, item: "Rename Genre" | "Delete Genre…") {
  await genreEntry(page, name).click({ button: "right" });
  await page.getByRole("menu").getByRole("menuitem", { name: item }).click();
}

test("Double-clicking a genre renames it in place", { tag: ["@genres.rename"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  await genreEntry(page, "Trip Hop").dblclick();
  // The name is selected: typing replaces it.
  await expect(renameField(page)).toBeFocused();
  await page.keyboard.type("Trip-Hop");
  await page.keyboard.press("Enter");

  await assertColumn(page, "Genres", ["All (4 Genres)", "Electronic", "Electronica", "Jazz", "Trip-Hop"]);
  // Dummy's primary genre, under its new name.
  await expect(albumCell(page, "Dummy", "Genre")).toHaveText("Trip-Hop");
  await pickInColumn(page, "Genres", "Trip-Hop");
  await assertShownAlbums(page, ["Dummy"]);
  await assertUnsavedChanges(page, 1);
});

test("Escape, an empty name or the same name change nothing", { tag: ["@genres.rename"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  const genres = ["All (4 Genres)", "Electronic", "Electronica", "Jazz", "Trip Hop"];

  // Escape.
  await genreEntry(page, "Jazz").dblclick();
  await renameField(page).fill("Bebop");
  await renameField(page).press("Escape");
  await assertColumn(page, "Genres", genres);

  // Empty.
  await genreEntry(page, "Jazz").dblclick();
  await renameField(page).fill("  ");
  await renameField(page).press("Enter");
  await assertColumn(page, "Genres", genres);

  // The same name.
  await genreEntry(page, "Jazz").dblclick();
  await renameField(page).press("Enter");
  await assertColumn(page, "Genres", genres);

  await assertUnsavedChanges(page, 0);
});

test("Rename Genre in the menu, applied by leaving the field", { tag: ["@genres.rename", "@genres.menu-picks"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  // Right-clicking picks the genre: only its album shows.
  await genreMenu(page, "Jazz", "Rename Genre");
  await assertShownAlbums(page, ["Blue Train"]);

  await renameField(page).fill("Hard Bop");
  // Clicking elsewhere leaves the field.
  await column(page, "Artists").click();
  await assertColumn(page, "Genres", ["All (4 Genres)", "Electronic", "Electronica", "Hard Bop", "Trip Hop"]);
  await assertColumnPick(page, "Genres", "Hard Bop");
  await expect(albumCell(page, "Blue Train", "Genre")).toHaveText("Hard Bop");
});

test("Renaming to another genre's name merges them", { tag: ["@genres.merge"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await pickInColumn(page, "Genres", "Electronica");
  await assertShownAlbums(page, ["Selected Ambient Works 85-92", "Music Has the Right to Children"]);

  // Cancelled: nothing changes.
  let question = answerConfirm(page, false);
  await genreEntry(page, "Electronica").dblclick();
  await renameField(page).fill("electronic");
  await renameField(page).press("Enter");
  expect(await question).toBe("A genre named “Electronic” already exists. Merge “Electronica” into it?");
  await assertColumn(page, "Genres", ["All (4 Genres)", "Electronic", "Electronica", "Jazz", "Trip Hop"]);

  question = answerConfirm(page);
  await genreEntry(page, "Electronica").dblclick();
  await renameField(page).fill("electronic");
  await renameField(page).press("Enter");
  await question;

  // Electronic is picked, with every album of both.
  await assertColumn(page, "Genres", ["All (3 Genres)", "Electronic", "Jazz", "Trip Hop"]);
  await assertColumnPick(page, "Genres", "Electronic");
  await assertShownAlbums(page, ["Moon Safari", "Selected Ambient Works 85-92", "Music Has the Right to Children", "Dummy"]);
  // Aphex Twin was under both: Electronic once, now primary.
  await expect(albumCell(page, "Selected Ambient Works 85-92", "Genre")).toHaveText("Electronic");
  await expect(albumCell(page, "Music Has the Right to Children", "Genre")).toHaveText("Electronic");
  await assertUnsavedChanges(page, 1);
});

test("Delete Genre removes it from its albums, after asking", { tag: ["@genres.delete"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  // Cancelled: nothing changes.
  let question = answerConfirm(page, false);
  await genreMenu(page, "Electronic", "Delete Genre…");
  expect(await question).toBe("Delete the genre “Electronic”? It will be removed from 3 albums.");
  await assertColumn(page, "Genres", ["All (4 Genres)", "Electronic", "Electronica", "Jazz", "Trip Hop"]);

  question = answerConfirm(page);
  await genreMenu(page, "Electronic", "Delete Genre…");
  await question;
  await assertColumn(page, "Genres", ["All (3 Genres)", "Electronica", "Jazz", "Trip Hop"]);
  // Moon Safari has no genre left; the others keep their other genre.
  await expect(albumCell(page, "Moon Safari", "Genre")).toHaveText("");
  await expect(albumCell(page, "Selected Ambient Works 85-92", "Genre")).toHaveText("Electronica");
  await expect(albumCell(page, "Dummy", "Genre")).toHaveText("Trip Hop");
  await assertUnsavedChanges(page, 1);
});

test("Deleting a genre of one album says so in the singular", { tag: ["@genres.delete"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  const question = answerConfirm(page, false);
  await genreMenu(page, "Jazz", "Delete Genre…");
  expect(await question).toBe("Delete the genre “Jazz”? It will be removed from 1 album.");
});
