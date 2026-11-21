import { expect, test } from "@playwright/test";
import {
  album,
  albumRow,
  assertDisplay,
  assertGridAlbums,
  assertShownAlbums,
  assertSortedBy,
  assertStatus,
  clickAlbum,
  daysAgo,
  genre,
  openApp,
  sortBy,
  switchView,
} from "../testutils.ts";

const AMBIENT = genre("Ambient");
const JAZZ = genre("Jazz");
const ROCK = genre("Rock");

test("Album List is the default view; the view is remembered", { tag: ["@browsing.views"] }, async ({ page }) => {
  await openApp(page, {
    albums: [
      album({ title: "Blue Train", artists: ["John Coltrane"] }),
      album({ title: "Ege Bamyasi", artists: ["Can"] }),
    ],
  });
  const viewButton = (name: string) => page.getByRole("group", { name: "View" }).getByRole("button", { name, exact: true });

  // Album List: the list, with a cover (here the blank one) in each row.
  await expect(viewButton("Album List")).toHaveAttribute("aria-pressed", "true");
  await assertShownAlbums(page, ["Ege Bamyasi", "Blue Train"]);
  await expect(albumRow(page, "Blue Train").locator(".thumb")).toBeVisible();

  // List: no covers.
  await switchView(page, "List");
  await assertShownAlbums(page, ["Ege Bamyasi", "Blue Train"]);
  await expect(albumRow(page, "Blue Train").locator(".thumb")).toHaveCount(0);

  // Grid: covers with the title and artist.
  await switchView(page, "Grid");
  await assertGridAlbums(page, ["Ege Bamyasi / Can", "Blue Train / John Coltrane"]);

  // Still the grid after a reload.
  await page.reload();
  await expect(viewButton("Grid")).toHaveAttribute("aria-pressed", "true");
  await assertGridAlbums(page, ["Ege Bamyasi / Can", "Blue Train / John Coltrane"]);
});

test("Clicking a column header sorts by it, clicking again reverses", { tag: ["@browsing.sort"] }, async ({ page }) => {
  await openApp(page, {
    albums: [
      album({ title: "Blue Train", artists: ["John Coltrane"], year: 1957, rating: 4, addedAt: daysAgo(3) }),
      album({ title: "Ege Bamyasi", artists: ["Can"], year: 1972, rating: 5, addedAt: daysAgo(1) }),
      album({ title: "Moon Safari", artists: ["Air"], year: 1998, rating: 3, addedAt: daysAgo(2) }),
    ],
  });

  // By artist by default.
  await assertSortedBy(page, "Artist", "ascending");
  await assertShownAlbums(page, ["Moon Safari", "Ege Bamyasi", "Blue Train"]);

  await sortBy(page, "Year");
  await assertSortedBy(page, "Year", "ascending");
  await assertShownAlbums(page, ["Blue Train", "Ege Bamyasi", "Moon Safari"]);

  await sortBy(page, "Year");
  await assertSortedBy(page, "Year", "descending");
  await assertShownAlbums(page, ["Moon Safari", "Ege Bamyasi", "Blue Train"]);

  // Rating and Date Added start with the highest, the newest.
  await sortBy(page, "Rating");
  await assertSortedBy(page, "Rating", "descending");
  await assertShownAlbums(page, ["Ege Bamyasi", "Blue Train", "Moon Safari"]);

  await sortBy(page, "Date Added");
  await assertSortedBy(page, "Date Added", "descending");
  await assertShownAlbums(page, ["Ege Bamyasi", "Moon Safari", "Blue Train"]);

  await sortBy(page, "Name");
  await assertSortedBy(page, "Name", "ascending");
  await assertShownAlbums(page, ["Blue Train", "Ege Bamyasi", "Moon Safari"]);

  await sortBy(page, "Name");
  await assertShownAlbums(page, ["Moon Safari", "Ege Bamyasi", "Blue Train"]);

  // The sort is remembered, and the grid uses it.
  await page.reload();
  await assertSortedBy(page, "Name", "descending");
  await assertShownAlbums(page, ["Moon Safari", "Ege Bamyasi", "Blue Train"]);
  await switchView(page, "Grid");
  await assertGridAlbums(page, ["Moon Safari / Air", "Ege Bamyasi / Can", "Blue Train / John Coltrane"]);
});

test("Artist and Name sorting use the sort artist and ignore a leading The", { tag: ["@browsing.sort-names"] }, async ({ page }) => {
  await openApp(page, {
    albums: [
      album({ title: "The Velvet Underground & Nico", artists: ["The Velvet Underground"] }),
      album({ title: "Kind of Blue", artists: ["Miles Davis"], artistSort: "Davis, Miles" }),
      album({ title: "Unwound", artists: ["Unwound"] }),
    ],
  });

  // Davis (Miles Davis), Unwound, Velvet Underground (not "The ...", before Unwound).
  await assertShownAlbums(page, ["Kind of Blue", "Unwound", "The Velvet Underground & Nico"]);

  // Kind, Unwound, Velvet.
  await sortBy(page, "Name");
  await assertShownAlbums(page, ["Kind of Blue", "Unwound", "The Velvet Underground & Nico"]);
});

test("Albums without a value come last in both directions", { tag: ["@browsing.sort-missing-last"] }, async ({ page }) => {
  await openApp(page, {
    genres: [JAZZ, ROCK],
    albums: [
      album({ title: "Blue Train", artists: ["John Coltrane"], year: 1957, genres: [JAZZ.id], rating: 4 }),
      album({ title: "Ege Bamyasi", artists: ["Can"], year: 1972, genres: [ROCK.id], rating: 5 }),
      album({ title: "Mystery Tape", artists: ["Anonymous"] }),
    ],
  });

  for (const column of ["Year", "Genre", "Rating"] as const) {
    await sortBy(page, column);
    await expect(page.getByRole("row").last()).toContainText("Mystery Tape");
    await sortBy(page, column);
    await expect(page.getByRole("row").last()).toContainText("Mystery Tape");
  }
});

test("Albums with the same value are ordered by artist, year, then title", { tag: ["@browsing.sort-ties"] }, async ({ page }) => {
  await openApp(page, {
    genres: [AMBIENT],
    albums: [
      album({ title: "Music for Airports", artists: ["Brian Eno"], year: 1978, genres: [AMBIENT.id] }),
      album({ title: "Apollo", artists: ["Brian Eno"], year: 1983, genres: [AMBIENT.id] }),
      album({ title: "Ambient 4", artists: ["Brian Eno"], year: 1982, genres: [AMBIENT.id] }),
      album({ title: "Thursday Afternoon", artists: ["Brian Eno"], year: 1985, genres: [AMBIENT.id] }),
      album({ title: "Selected Ambient Works", artists: ["Aphex Twin"], year: 1985, genres: [AMBIENT.id] }),
      album({ title: "Another Green World", artists: ["Brian Eno"], year: 1985, genres: [AMBIENT.id] }),
    ],
  });

  await sortBy(page, "Genre");
  await assertShownAlbums(page, [
    "Selected Ambient Works",
    "Music for Airports",
    "Ambient 4",
    "Apollo",
    "Another Green World",
    "Thursday Afternoon",
  ]);
});

test("An empty library says how to add an album", { tag: ["@browsing.empty"] }, async ({ page }) => {
  await openApp(page, { albums: [] });

  await expect(page.getByText("Your library is empty. Click + to add an album.")).toBeVisible();
  await assertStatus(page, "0 albums");
});

test("The status bar counts the albums shown and selected", { tag: ["@browsing.status-count"] }, async ({ page }) => {
  await openApp(page, {
    albums: [
      album({ title: "Blue Train", artists: ["John Coltrane"] }),
      album({ title: "Ege Bamyasi", artists: ["Can"] }),
      album({ title: "Moon Safari", artists: ["Air"] }),
    ],
  });
  await assertStatus(page, "3 albums");

  await clickAlbum(page, "Moon Safari");
  await assertStatus(page, "3 albums");

  await clickAlbum(page, "Blue Train", ["Shift"]);
  await assertStatus(page, "3 albums · 3 selected");
});

test("The display shows the selected album, or the selection's size", { tag: ["@browsing.display"] }, async ({ page }) => {
  await openApp(page, {
    albums: [
      album({ title: "Blue Train", artists: ["John Coltrane"], year: 1957 }),
      album({ title: "Ege Bamyasi", artists: ["Can"] }),
    ],
  });
  await assertDisplay(page, "FliTunes", "All changes saved");

  await clickAlbum(page, "Blue Train");
  await assertDisplay(page, "Blue Train", "John Coltrane — 1957");

  // No year: no dash.
  await clickAlbum(page, "Ege Bamyasi");
  await assertDisplay(page, "Ege Bamyasi", "Can");

  await clickAlbum(page, "Blue Train", ["ControlOrMeta"]);
  await assertDisplay(page, "2 albums selected", "⌘I to edit them together");
});
