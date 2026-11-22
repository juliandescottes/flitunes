import { expect, test } from "@playwright/test";
import {
  addChip,
  album,
  albumCell,
  assertChips,
  assertColumn,
  assertColumnPick,
  assertDisplay,
  assertListCover,
  assertSelectedAlbums,
  assertSelectedSource,
  assertShownAlbums,
  assertSources,
  assertUnsavedChanges,
  chipsWithPlaceholder,
  fakeOembed,
  genre,
  infoField,
  openAddSheet,
  openApp,
  openGetInfo,
  pasteInto,
  pickInColumn,
  searchField,
  searchFor,
  selectSource,
  sheet,
} from "../testutils.ts";

const ELECTRONIC = genre("Electronic");
const JAZZ = genre("Jazz");

const LIBRARY = {
  genres: [ELECTRONIC, JAZZ],
  albums: [
    album({ title: "Moon Safari", artists: ["Air"], year: 1998, genres: [ELECTRONIC.id] }),
    album({ title: "Blue Train", artists: ["John Coltrane"], year: 1957, genres: [JAZZ.id] }),
  ],
};

// Spotify ids of albums the fake oEmbed knows.
const MEZZANINE = "4K8nXS3E9yxcD4mLw3sYvB";
const KIND_OF_BLUE = "1weenld61qoidwYuZ1GESA";

test("Cancel or Escape closes the sheet without adding, and it starts empty again", { tag: ["@adding-albums.open"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  // Escape.
  let add = await openAddSheet(page);
  await add.getByLabel("Title").fill("Mezzanine");
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toBeHidden();

  // Cancel, after typing again: the title from before is gone.
  add = await openAddSheet(page);
  await expect(add.getByLabel("Title")).toHaveValue("");
  await add.getByLabel("Title").fill("Mezzanine");
  await add.getByRole("button", { name: "Cancel" }).click();
  await expect(sheet(page)).toBeHidden();

  // Nothing was added.
  await assertShownAlbums(page, ["Moon Safari", "Blue Train"]);
  await assertUnsavedChanges(page, 0);
});

test(
  "A new album is shown in Music, selected, with the search and columns cleared",
  { tag: ["@adding-albums.fields", "@adding-albums.added"] },
  async ({ page }) => {
    await openApp(page, LIBRARY);
    // Somewhere else first: Jazz, searching for "train".
    await pickInColumn(page, "Genres", "Jazz");
    await searchFor(page, "train");
    await assertShownAlbums(page, ["Blue Train"]);

    const add = await openAddSheet(page);
    await add.getByLabel("Title").fill("Mezzanine");
    await add.getByLabel("Artist").fill("Massive Attack");
    await add.getByLabel("Year").fill("1998");
    await addChip(chipsWithPlaceholder(add, "Add genre"), "Electronic");
    await addChip(chipsWithPlaceholder(add, "Add to playlist"), "Late Night");
    await assertChips(chipsWithPlaceholder(add, "Add genre"), ["Electronic"]);
    await add.getByRole("button", { name: "Add", exact: true }).click();
    await expect(sheet(page)).toBeHidden();

    // Back to Music, everything shown. Sorted by artist: Air, Coltrane, Massive Attack.
    await assertSelectedSource(page, "Music");
    await expect(searchField(page)).toHaveValue("");
    await assertColumnPick(page, "Genres", "All (2 Genres)");
    await assertShownAlbums(page, ["Moon Safari", "Blue Train", "Mezzanine"]);
    await assertSelectedAlbums(page, ["Mezzanine"]);
    await assertDisplay(page, "Mezzanine", "Massive Attack — 1998");
    await expect(albumCell(page, "Mezzanine", "Genre")).toHaveText("Electronic");
    await assertSources(page, ["Music", "Recently Added", "Late Night"]);
    await assertUnsavedChanges(page, 1);

    // Added today: the only recent album.
    await selectSource(page, "Recently Added");
    await assertShownAlbums(page, ["Mezzanine"]);
  },
);

test("Several artists are separated by \";\", and Compilation fills in Various Artists", { tag: ["@adding-albums.fields"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  let add = await openAddSheet(page);
  await add.getByLabel("Title").fill("My Life in the Bush of Ghosts");
  await add.getByLabel("Artist").fill("Brian Eno; David Byrne");
  await add.getByRole("button", { name: "Add", exact: true }).click();
  await expect(albumCell(page, "My Life in the Bush of Ghosts", "Artist")).toHaveText("Brian Eno, David Byrne");
  await assertColumn(page, "Artists", ["All (4 Artists)", "Air", "Brian Eno", "David Byrne", "John Coltrane"]);

  add = await openAddSheet(page);
  await add.getByRole("button", { name: "Compilation" }).click();
  await expect(add.getByLabel("Artist")).toHaveValue("Various Artists");
});

test("Title and Artist are required, and the year must be a number", { tag: ["@adding-albums.fields"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  const add = await openAddSheet(page);

  // No title: nothing happens.
  await add.getByLabel("Artist").fill("Massive Attack");
  await add.getByRole("button", { name: "Add", exact: true }).click();
  await expect(add).toBeVisible();

  // No artist: nothing happens.
  await add.getByLabel("Title").fill("Mezzanine");
  await add.getByLabel("Artist").fill("");
  await add.getByRole("button", { name: "Add", exact: true }).click();
  await expect(add).toBeVisible();

  // Not a year.
  await add.getByLabel("Artist").fill("Massive Attack");
  await add.getByLabel("Year").fill("late 90s");
  await add.getByRole("button", { name: "Add", exact: true }).click();
  await expect(add.getByText("Year must be a number")).toBeVisible();

  await assertShownAlbums(page, ["Moon Safari", "Blue Train"]);
  await assertUnsavedChanges(page, 0);
});

test(
  "A Spotify link fills in the title and cover, and the cover is copied into the library",
  { tag: ["@adding-albums.spotify-lookup", "@adding-albums.keep-cover"] },
  async ({ page }) => {
    await fakeOembed(page, {
      [MEZZANINE]: { title: "Mezzanine", cover: "https://i.scdn.co/image/ab67616d00001e02mezzanine" },
    });
    const { keptCovers } = await openApp(page, LIBRARY);

    const add = await openAddSheet(page);
    await add.getByLabel("Spotify link").fill(`https://open.spotify.com/album/${MEZZANINE}?si=abc`);
    await expect(add.getByLabel("Title")).toHaveValue("Mezzanine");
    // Spotify's large cover rather than the 300 pixel one.
    await expect(add.getByLabel("Cover URL")).toHaveValue("https://i.scdn.co/image/ab67616d0000b273mezzanine");
    await add.getByLabel("Artist").fill("Massive Attack");
    await add.getByRole("button", { name: "Add", exact: true }).click();
    await assertSelectedAlbums(page, ["Mezzanine"]);

    // The cover was copied, and the album now points to the file.
    await expect.poll(() => keptCovers.map((c) => c.url)).toEqual(["https://i.scdn.co/image/ab67616d0000b273mezzanine"]);
    await assertListCover(page, "Mezzanine", new RegExp(`/__library/covers/${keptCovers[0].albumId}\\.jpg$`));
    const info = await openGetInfo(page);
    await expect(infoField(info, "Spotify")).toHaveValue(`https://open.spotify.com/album/${MEZZANINE}`);
    await info.getByRole("tab", { name: "Artwork" }).click();
    await expect(infoField(info, "Cover URL")).toHaveValue(`covers/${keptCovers[0].albumId}.jpg`);
  },
);

test("A link that can't be looked up, or isn't an album link, says so", { tag: ["@adding-albums.spotify-lookup"] }, async ({ page }) => {
  // The fake oEmbed knows no album: every lookup fails.
  await fakeOembed(page, {});
  await openApp(page, LIBRARY);
  const add = await openAddSheet(page);

  await add.getByLabel("Spotify link").fill(`https://open.spotify.com/album/${MEZZANINE}`);
  await expect(add.getByText("Spotify lookup failed: HTTP 404. You can still fill in the fields by hand.")).toBeVisible();

  // The fields can still be filled by hand.
  await add.getByLabel("Title").fill("Mezzanine");
  await add.getByLabel("Artist").fill("Massive Attack");
  await add.getByRole("button", { name: "Add", exact: true }).click();
  await assertSelectedAlbums(page, ["Mezzanine"]);

  // A track link.
  await openAddSheet(page);
  await add.getByLabel("Spotify link").fill("https://open.spotify.com/track/2takcwOaAZWiXQijPHIx7B");
  await expect(add.getByText("Not a Spotify album or playlist link.")).toBeVisible();
});

test("A link already in the library is named, and can be added anyway", { tag: ["@adding-albums.duplicate"] }, async ({ page }) => {
  await fakeOembed(page, { [KIND_OF_BLUE]: { title: "Kind of Blue" } });
  await openApp(page, {
    albums: [album({ title: "Kind of Blue", artists: ["Miles Davis"], spotify: `spotify:album:${KIND_OF_BLUE}` })],
  });

  const add = await openAddSheet(page);
  await expect(add.getByRole("button", { name: "Add", exact: true })).toBeVisible();
  await add.getByLabel("Spotify link").fill(`https://open.spotify.com/intl-fr/album/${KIND_OF_BLUE}`);
  await expect(add.getByText("Already in the library: Miles Davis — Kind of Blue")).toBeVisible();

  await add.getByLabel("Artist").fill("Miles Davis");
  await add.getByRole("button", { name: "Add Anyway" }).click();
  await assertShownAlbums(page, ["Kind of Blue", "Kind of Blue"]);
});

test("Pasting several links switches to Add Several", { tag: ["@adding-albums.several-open"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  const add = await openAddSheet(page);

  await pasteInto(add.getByLabel("Spotify link"), `https://open.spotify.com/album/${MEZZANINE}\nhttps://open.spotify.com/album/${KIND_OF_BLUE}`);
  await expect(add.getByRole("heading", { name: "Add Several Albums" })).toBeVisible();
  await expect(add.getByLabel("Spotify links")).toHaveValue(
    `https://open.spotify.com/album/${MEZZANINE}\nhttps://open.spotify.com/album/${KIND_OF_BLUE}`,
  );
});
