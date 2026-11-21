import { expect, test, type Page } from "@playwright/test";
import {
  addChip,
  album,
  albumCell,
  assertSelectedAlbums,
  assertSelectedSource,
  assertShownAlbums,
  assertUnsavedChanges,
  chipsWithPlaceholder,
  genre,
  infoField,
  openAddSheet,
  openApp,
  openGetInfo,
  clickAlbum,
  sheet,
  textFile,
} from "../testutils.ts";

const ROCK = genre("Rock");

const LIBRARY = {
  genres: [ROCK],
  albums: [album({ title: "Abbey Road", artists: ["The Beatles"], year: 1969, genres: [ROCK.id] })],
};

/** A listening history export: plays per album, a Spotify link for some. */
const HISTORY = `Artist,Album,Year,Plays,Spotify
Beatles,abbey road,1969,120,
Radiohead,OK Computer,1997,85,https://open.spotify.com/album/6dVIqQ8qmQ5GBnJ9shOYGE
Portishead,Dummy,1994,40,
Can,,1972,30,
Pavement,Slanted and Enchanted,1992,3,
`;

/** Opens Import CSV and chooses a file. */
async function importCsv(page: Page, name: string, text: string) {
  const add = await openAddSheet(page);
  await add.getByRole("button", { name: "Import CSV…" }).click();
  await add.getByLabel("Choose File…").setInputFiles(textFile(name, text));
  return add;
}

/** The rows offered, as "Artist – Title". */
function rows(add: import("@playwright/test").Locator) {
  return add.getByRole("checkbox", { name: /^Add / });
}

test("A file without album and artist columns is refused", { tag: ["@adding-albums.csv-columns"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  const add = await importCsv(page, "bands.csv", "Record,Band\nDummy,Portishead\n");
  await expect(add.getByText('Expected a header row with "album" and "artist" columns')).toBeVisible();
});

test(
  "Rows start unticked, Tick All Shown skips those already in the library",
  { tag: ["@adding-albums.csv-columns", "@adding-albums.csv-pick"] },
  async ({ page }) => {
    await openApp(page, LIBRARY);
    const add = await importCsv(page, "history.csv", HISTORY);

    // Can has no album name: skipped. Abbey Road is already in the library
    // (by "The Beatles", in other case).
    await expect(rows(add)).toHaveCount(4);
    for (const name of ["Beatles – abbey road", "Radiohead – OK Computer", "Portishead – Dummy", "Pavement – Slanted and Enchanted"]) {
      await expect(add.getByRole("checkbox", { name: `Add ${name}` })).not.toBeChecked();
    }
    await expect(add.getByText("Already in the library")).toHaveCount(1);
    await expect(add.getByRole("row", { name: /abbey road/ })).toContainText("Already in the library");
    await expect(add.getByRole("button", { name: "Add 0 Albums" })).toBeDisabled();

    // Every row but Abbey Road.
    await add.getByRole("button", { name: "Tick All Shown" }).click();
    await expect(add.getByRole("checkbox", { name: "Add Beatles – abbey road" })).not.toBeChecked();
    await expect(add.getByRole("button", { name: "Add 3 Albums" })).toBeEnabled();

    await add.getByRole("button", { name: "Untick All" }).click();
    await expect(add.getByRole("checkbox", { checked: true })).toHaveCount(0);

    // Clicking a row ticks it, and unticks it again.
    await add.getByRole("row", { name: /Dummy/ }).getByRole("cell", { name: "Portishead", exact: true }).click();
    await expect(add.getByRole("checkbox", { name: "Add Portishead – Dummy" })).toBeChecked();
    await add.getByRole("row", { name: /Dummy/ }).getByRole("cell", { name: "Portishead", exact: true }).click();
    await expect(add.getByRole("checkbox", { name: "Add Portishead – Dummy" })).not.toBeChecked();
  },
);

test(
  "The plays threshold hides rows, and only the ticked rows shown are added",
  { tag: ["@adding-albums.csv-plays", "@adding-albums.csv-added"] },
  async ({ page }) => {
    await openApp(page, LIBRARY);
    const add = await importCsv(page, "history.csv", HISTORY);
    await expect(add.getByText("4 of 4 shown")).toBeVisible();

    // Tick Slanted and Enchanted (3 plays), then hide it.
    await add.getByRole("checkbox", { name: "Add Pavement – Slanted and Enchanted" }).check();
    await add.getByLabel("Show albums with at least").fill("10");
    await expect(add.getByText("3 of 4 shown")).toBeVisible();
    await expect(rows(add)).toHaveCount(3);

    // Tick the others shown, file them under Rock.
    await add.getByRole("button", { name: "Tick All Shown" }).click();
    await addChip(chipsWithPlaceholder(add, "Add genre"), "Rock");
    await add.getByRole("button", { name: "Add 2 Albums" }).click();
    await expect(sheet(page)).toBeHidden();

    // Sorted by artist: Beatles, Portishead, Radiohead. Pavement wasn't added.
    await assertSelectedSource(page, "Music");
    await assertShownAlbums(page, ["Abbey Road", "Dummy", "OK Computer"]);
    await assertSelectedAlbums(page, ["Dummy", "OK Computer"]);
    await expect(albumCell(page, "OK Computer", "Year")).toHaveText("1997");
    await expect(albumCell(page, "OK Computer", "Genre")).toHaveText("Rock");
    await expect(albumCell(page, "Dummy", "Genre")).toHaveText("Rock");
    await assertUnsavedChanges(page, 1);

    // The Spotify link came along.
    await clickAlbum(page, "OK Computer");
    const info = await openGetInfo(page);
    await expect(infoField(info, "Spotify")).toHaveValue("https://open.spotify.com/album/6dVIqQ8qmQ5GBnJ9shOYGE");
  },
);

test("Back returns to choosing a file", { tag: ["@adding-albums.csv-added"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  const add = await importCsv(page, "history.csv", HISTORY);
  await expect(rows(add)).toHaveCount(4);

  await add.getByRole("button", { name: "Back" }).click();
  await expect(add.getByLabel("Choose File…")).toBeAttached();
  await expect(rows(add)).toHaveCount(0);
});
