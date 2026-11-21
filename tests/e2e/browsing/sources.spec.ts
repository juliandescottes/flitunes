import { expect, test } from "@playwright/test";
import {
  album,
  assertColumnPick,
  assertShownAlbums,
  assertSources,
  daysAgo,
  genre,
  openApp,
  pickInColumn,
  selectSource,
} from "../testutils.ts";

const JAZZ = genre("Jazz");
const ROCK = genre("Rock");

test("Music shows every album except the ones in triage", { tag: ["@browsing.music"] }, async ({ page }) => {
  await openApp(page, {
    albums: [
      album({ title: "Blue Train", artists: ["John Coltrane"] }),
      album({ title: "Ege Bamyasi", artists: ["Can"], tags: ["vinyl"] }),
      album({ title: "Unreviewed Import", artists: ["Somebody"], tags: ["triage"] }),
    ],
  });

  await assertShownAlbums(page, ["Ege Bamyasi", "Blue Train"]);
});

test("Recently Added shows the albums added in the last 30 days", { tag: ["@browsing.recently-added"] }, async ({ page }) => {
  await openApp(page, {
    albums: [
      album({ title: "Added Today", artists: ["Artist A"], addedAt: daysAgo(0) }),
      album({ title: "Added 29 Days Ago", artists: ["Artist B"], addedAt: daysAgo(29) }),
      album({ title: "Added 31 Days Ago", artists: ["Artist C"], addedAt: daysAgo(31) }),
      album({ title: "Recent Import", artists: ["Artist D"], addedAt: daysAgo(1), tags: ["triage"] }),
    ],
  });

  await selectSource(page, "Recently Added");
  await assertShownAlbums(page, ["Added Today", "Added 29 Days Ago"]);
});

test("Playlists list the tags in use, and show their albums", { tag: ["@browsing.playlists"] }, async ({ page }) => {
  await openApp(page, {
    albums: [
      album({ title: "Blue Train", artists: ["John Coltrane"], tags: ["vinyl", "Favorites"] }),
      album({ title: "Ege Bamyasi", artists: ["Can"], tags: ["vinyl"] }),
      album({ title: "Moon Safari", artists: ["Air"] }),
      // A tag used only in triage is not a playlist yet.
      album({ title: "Unreviewed Import", artists: ["Somebody"], tags: ["triage", "road trip"] }),
    ],
  });

  // Sorted by name, ignoring case, after the library sources (Triage shows
  // while it has albums).
  await assertSources(page, ["Music", "Recently Added", "Triage 1", "Favorites", "vinyl"]);

  await selectSource(page, "vinyl");
  await assertShownAlbums(page, ["Ege Bamyasi", "Blue Train"]);

  await selectSource(page, "Favorites");
  await assertShownAlbums(page, ["Blue Train"]);
});

test("Without playlists, the section says how to make one", { tag: ["@browsing.playlists"] }, async ({ page }) => {
  await openApp(page, { albums: [album({ title: "Moon Safari", artists: ["Air"] })] });

  await assertSources(page, ["Music", "Recently Added"]);
  await expect(page.getByText("Tag albums to make playlists.")).toBeVisible();
});

test("Selecting a source resets the column browser", { tag: ["@browsing.source-resets-columns"] }, async ({ page }) => {
  await openApp(page, {
    genres: [JAZZ, ROCK],
    albums: [
      album({ title: "Blue Train", artists: ["John Coltrane"], genres: [JAZZ.id], tags: ["vinyl"] }),
      album({ title: "Ege Bamyasi", artists: ["Can"], genres: [ROCK.id], tags: ["vinyl"] }),
    ],
  });

  // Narrow Music down to one album.
  await pickInColumn(page, "Genres", "Jazz");
  await pickInColumn(page, "Artists", "John Coltrane");
  await pickInColumn(page, "Albums", "Blue Train");
  await assertShownAlbums(page, ["Blue Train"]);

  // A playlist starts from All again.
  await selectSource(page, "vinyl");
  await assertColumnPick(page, "Genres", "All (2 Genres)");
  await assertColumnPick(page, "Artists", "All (2 Artists)");
  await assertColumnPick(page, "Albums", "All (2 Albums)");
  await assertShownAlbums(page, ["Ege Bamyasi", "Blue Train"]);
});
