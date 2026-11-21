import { expect, test } from "@playwright/test";
import {
  album,
  assertShownAlbums,
  assertStatus,
  clickAlbum,
  genre,
  openApp,
  searchField,
  searchFor,
  toggleLinkFilter,
} from "../testutils.ts";

const JAZZ = genre("Jazz");
const ROCK = genre("Rock");

const LIBRARY = {
  genres: [JAZZ, ROCK],
  albums: [
    album({ title: "Blue Train", artists: ["John Coltrane"], year: 1957, genres: [JAZZ.id], tags: ["vinyl"] }),
    album({ title: "Ege Bamyasi", artists: ["Can"], year: 1972, genres: [ROCK.id] }),
    album({ title: "La question", artists: ["Françoise Hardy"], year: 1971, genres: [ROCK.id], tags: ["road trip"] }),
  ],
};

test("Search matches the title, artists, year, genres and playlists", { tag: ["@browsing.search"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await assertShownAlbums(page, ["Ege Bamyasi", "La question", "Blue Train"]);

  // Title, ignoring case.
  await searchFor(page, "TRAIN");
  await assertShownAlbums(page, ["Blue Train"]);

  // Artist, ignoring accents.
  await searchFor(page, "francoise");
  await assertShownAlbums(page, ["La question"]);

  // Year.
  await searchFor(page, "1972");
  await assertShownAlbums(page, ["Ege Bamyasi"]);

  // Genre.
  await searchFor(page, "jazz");
  await assertShownAlbums(page, ["Blue Train"]);

  // Playlist.
  await searchFor(page, "road");
  await assertShownAlbums(page, ["La question"]);

  // Every word must match.
  await searchFor(page, "rock 1971");
  await assertShownAlbums(page, ["La question"]);
});

test("A search that matches nothing says so", { tag: ["@browsing.search", "@browsing.empty"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  await searchFor(page, "can 1957");
  await expect(page.getByText("No albums match.")).toBeVisible();
  await assertStatus(page, "0 albums");
});

test("Escape or the clear button empties the search", { tag: ["@browsing.search-clear"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  await searchFor(page, "blue");
  await assertShownAlbums(page, ["Blue Train"]);
  await searchField(page).press("Escape");
  await expect(searchField(page)).toHaveValue("");
  await assertShownAlbums(page, ["Ege Bamyasi", "La question", "Blue Train"]);

  await searchFor(page, "blue");
  await assertShownAlbums(page, ["Blue Train"]);
  await page.getByRole("button", { name: "Clear the search" }).click();
  await expect(searchField(page)).toHaveValue("");
  await assertShownAlbums(page, ["Ege Bamyasi", "La question", "Blue Train"]);
});

test("Cmd+F focuses the search field with its text selected", { tag: ["@browsing.search-focus"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await searchFor(page, "blue");

  // Leave the field for the album list.
  await clickAlbum(page, "Blue Train");
  await expect(searchField(page)).not.toBeFocused();

  await page.keyboard.press("ControlOrMeta+f");
  await expect(searchField(page)).toBeFocused();

  // The text was selected: typing replaces it.
  await page.keyboard.type("can");
  await expect(searchField(page)).toHaveValue("can");
  await assertShownAlbums(page, ["Ege Bamyasi"]);
});

test("The link filter hides albums without a Spotify link, and is remembered", { tag: ["@browsing.link-filter"] }, async ({ page }) => {
  await openApp(page, {
    albums: [
      album({ title: "Blue Train", artists: ["John Coltrane"], spotify: "spotify:album:1weenld61qoidwYuZ1GESA" }),
      album({ title: "Unlinked Bootleg", artists: ["Can"] }),
    ],
  });
  await assertShownAlbums(page, ["Unlinked Bootleg", "Blue Train"]);
  await assertStatus(page, "2 albums");

  await toggleLinkFilter(page);
  await assertShownAlbums(page, ["Blue Train"]);
  await assertStatus(page, "1 album · albums without a Spotify link hidden");

  // Still on after a reload.
  await page.reload();
  await assertShownAlbums(page, ["Blue Train"]);
  await assertStatus(page, "1 album · albums without a Spotify link hidden");

  await toggleLinkFilter(page);
  await assertShownAlbums(page, ["Unlinked Bootleg", "Blue Train"]);
  await assertStatus(page, "2 albums");
});
