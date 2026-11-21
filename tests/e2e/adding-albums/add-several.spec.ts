import { expect, test } from "@playwright/test";
import {
  addChip,
  album,
  albumCell,
  assertSelectedAlbums,
  assertSelectedSource,
  assertShownAlbums,
  assertStatus,
  assertUnsavedChanges,
  assertValues,
  chipsWithPlaceholder,
  fakeOembed,
  genre,
  openAddSheet,
  openApp,
  selectSource,
  sheet,
} from "../testutils.ts";

const TRIP_HOP = genre("Trip Hop");

// Spotify ids.
const MEZZANINE = "4K8nXS3E9yxcD4mLw3sYvB";
const DUMMY = "3539EbNgIdEDGBKkUf4wno";
const BLUE_LINES = "6GmX1ZKQVkc3bfAu6kMHnD";
const KIND_OF_BLUE = "1weenld61qoidwYuZ1GESA";

const link = (id: string) => `https://open.spotify.com/album/${id}`;

const LIBRARY = {
  genres: [TRIP_HOP],
  albums: [album({ title: "Kind of Blue", artists: ["Miles Davis"], spotify: `spotify:album:${KIND_OF_BLUE}` })],
};

/** Opens Add Several from the Add to Library sheet. */
async function openAddSeveral(page: import("@playwright/test").Page) {
  const add = await openAddSheet(page);
  await add.getByRole("button", { name: "Add Several…" }).click();
  await expect(add.getByRole("heading", { name: "Add Several Albums" })).toBeVisible();
  return add;
}

test("Add Several keeps the link typed so far, and Add One goes back", { tag: ["@adding-albums.several-open"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  const add = await openAddSheet(page);
  await add.getByLabel("Spotify link").fill(link(MEZZANINE));

  await add.getByRole("button", { name: "Add Several…" }).click();
  await expect(add.getByLabel("Spotify links")).toHaveValue(link(MEZZANINE));

  await add.getByRole("button", { name: "Add One…" }).click();
  await expect(add.getByRole("heading", { name: "Add to Library" })).toBeVisible();
});

test("The links are counted, repeats ignored, and other text listed as skipped", { tag: ["@adding-albums.several-links"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  const add = await openAddSeveral(page);
  const lookUp = add.getByRole("button", { name: "Look Up" });

  // No link yet.
  await expect(add.getByText("0 albums")).toBeVisible();
  await expect(lookUp).toBeDisabled();

  // Two albums, one of them twice, on lines or after a comma, and a word.
  await add.getByLabel("Spotify links").fill(`${link(MEZZANINE)}\n${link(DUMMY)}, ${link(MEZZANINE)}\nsoon`);
  await expect(add.getByText("2 albums")).toBeVisible();
  await expect(add.getByText("Not album or playlist links, will be skipped: soon")).toBeVisible();
  await expect(lookUp).toBeEnabled();
});

test(
  "Look Up lists each link to complete, and the ticked ones are added together",
  { tag: ["@adding-albums.several-review", "@adding-albums.several-added"] },
  async ({ page }) => {
    // Blue Lines can't be looked up.
    await fakeOembed(page, { [MEZZANINE]: { title: "Mezzanine" }, [DUMMY]: { title: "Dummy" } });
    await openApp(page, LIBRARY);
    const add = await openAddSeveral(page);
    await add.getByLabel("Spotify links").fill([MEZZANINE, DUMMY, BLUE_LINES, KIND_OF_BLUE].map(link).join("\n"));
    await add.getByRole("button", { name: "Look Up" }).click();

    // One row per link, in order. Kind of Blue is already in the library: unticked.
    const names = add.getByRole("textbox", { name: "Name" });
    await assertValues(names, ["Mezzanine", "Dummy", "", ""]);
    await expect(names.nth(2)).toHaveAttribute("placeholder", "Lookup failed: type the name");
    await expect(add.getByText("Already in the library")).toHaveCount(1);
    await expect(add.getByRole("checkbox", { name: "Add Mezzanine" })).toBeChecked();
    await expect(add.getByRole("checkbox", { name: "Add this album" }).first()).toBeChecked();
    await expect(add.getByRole("checkbox").nth(3)).not.toBeChecked();
    await expect(add.getByRole("button", { name: "Add 3 Albums" })).toBeVisible();

    // An artist is needed in each ticked row: nothing is added yet.
    const artists = add.getByRole("textbox", { name: "Artist" });
    await artists.nth(0).fill("Massive Attack");
    await add.getByRole("button", { name: "Add 3 Albums" }).click();
    await expect(add).toBeVisible();

    // Leave Dummy out, name Blue Lines, file both under Trip Hop.
    await add.getByRole("checkbox", { name: "Add Dummy" }).uncheck();
    await names.nth(2).fill("Blue Lines");
    await artists.nth(2).fill("Massive Attack");
    await add.getByRole("textbox", { name: "Year" }).nth(2).fill("1991");
    await addChip(chipsWithPlaceholder(add, "Add genre"), "Trip Hop");
    await add.getByRole("button", { name: "Add 2 Albums" }).click();
    await expect(sheet(page)).toBeHidden();

    // Both shown in Music and selected, as one change. Sorted by artist
    // (Massive Attack, Miles Davis), then year: Blue Lines (1991) before
    // Mezzanine (no year).
    await assertSelectedSource(page, "Music");
    await assertShownAlbums(page, ["Blue Lines", "Mezzanine", "Kind of Blue"]);
    await assertSelectedAlbums(page, ["Blue Lines", "Mezzanine"]);
    await assertStatus(page, "3 albums · 2 selected");
    await expect(albumCell(page, "Blue Lines", "Genre")).toHaveText("Trip Hop");
    await expect(albumCell(page, "Mezzanine", "Genre")).toHaveText("Trip Hop");
    await assertUnsavedChanges(page, 1);
    await selectSource(page, "Recently Added");
    await assertShownAlbums(page, ["Blue Lines", "Mezzanine"]);
  },
);

test("Back returns to the links", { tag: ["@adding-albums.several-review"] }, async ({ page }) => {
  await fakeOembed(page, { [MEZZANINE]: { title: "Mezzanine" } });
  await openApp(page, LIBRARY);
  const add = await openAddSeveral(page);
  await add.getByLabel("Spotify links").fill(link(MEZZANINE));
  await add.getByRole("button", { name: "Look Up" }).click();
  await assertValues(add.getByRole("textbox", { name: "Name" }), ["Mezzanine"]);

  await add.getByRole("button", { name: "Back" }).click();
  await expect(add.getByLabel("Spotify links")).toHaveValue(link(MEZZANINE));
});
