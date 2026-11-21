import { expect, test } from "@playwright/test";
import {
  addChip,
  album,
  albumCell,
  assertChips,
  assertColumn,
  assertShownAlbums,
  assertSources,
  chipField,
  chipInput,
  clickAlbum,
  genre,
  openApp,
  openGetInfo,
  selectSource,
} from "../testutils.ts";

const AMBIENT = genre("Ambient");
const ELECTRONIC = genre("Electronic");
const HIP_HOP = genre("Hip-Hop");

const LIBRARY = {
  genres: [AMBIENT, ELECTRONIC, HIP_HOP],
  albums: [
    album({ title: "Selected Ambient Works", artists: ["Aphex Twin"], genres: [ELECTRONIC.id, AMBIENT.id], tags: ["focus"] }),
    album({ title: "Donuts", artists: ["J Dilla"], genres: [HIP_HOP.id], tags: ["vinyl"] }),
  ],
};

test("The first genre is the primary one; another can be promoted, or removed", { tag: ["@album-editing.genre-chips"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await expect(albumCell(page, "Selected Ambient Works", "Genre")).toHaveText("Electronic");
  await clickAlbum(page, "Selected Ambient Works");
  const info = await openGetInfo(page);
  const genres = chipField(info, "Genres");

  // Electronic is primary, highlighted.
  await assertChips(genres, ["Electronic", "Ambient"]);
  await expect(genres.locator(".chip.primary")).toHaveText(/Electronic/);

  // Clicking Ambient makes it primary.
  await genres.getByRole("button", { name: "Ambient", exact: true }).click();
  await assertChips(genres, ["Ambient", "Electronic"]);
  await expect(genres.locator(".chip.primary")).toHaveText(/Ambient/);
  await info.getByRole("button", { name: "OK" }).click();
  await expect(albumCell(page, "Selected Ambient Works", "Genre")).toHaveText("Ambient");

  // The × removes a genre.
  await openGetInfo(page);
  await genres.getByRole("button", { name: "Remove Ambient" }).click();
  await assertChips(genres, ["Electronic"]);

  // Backspace in the empty field removes the last one.
  await chipInput(genres).press("Backspace");
  await assertChips(genres, []);
  await info.getByRole("button", { name: "OK" }).click();
  await expect(albumCell(page, "Selected Ambient Works", "Genre")).toHaveText("");
  await assertColumn(page, "Genres", ["All (1 Genre)", "Hip-Hop"]);
});

test("A typed genre name adds the existing genre, or offers to create it", { tag: ["@album-editing.genre-add"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await clickAlbum(page, "Donuts");
  const info = await openGetInfo(page);
  const genres = chipField(info, "Genres");

  // "hip hop" is Hip-Hop, ignoring case and punctuation: no duplicate.
  await chipInput(genres).fill("hip hop");
  await expect(genres.getByRole("button", { name: "Add", exact: true })).toBeVisible();
  await chipInput(genres).press("Enter");
  await assertChips(genres, ["Hip-Hop"]);

  // "electronic" is an existing genre, added with its own name.
  await addChip(genres, "electronic");
  await assertChips(genres, ["Hip-Hop", "Electronic"]);

  // An unknown name offers to create the genre.
  await chipInput(genres).fill("Instrumental Hip-Hop");
  await genres.getByRole("button", { name: "Create “Instrumental Hip-Hop”" }).click();
  await assertChips(genres, ["Hip-Hop", "Electronic", "Instrumental Hip-Hop"]);
  await expect(chipInput(genres)).toHaveValue("");

  await info.getByRole("button", { name: "OK" }).click();
  await assertColumn(page, "Genres", ["All (4 Genres)", "Ambient", "Electronic", "Hip-Hop", "Instrumental Hip-Hop"]);
});

test("A typed playlist name adds the existing playlist, or makes a new one", { tag: ["@album-editing.playlist-chips"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await assertSources(page, ["Music", "Recently Added", "focus", "vinyl"]);
  await clickAlbum(page, "Selected Ambient Works");
  const info = await openGetInfo(page);
  const playlists = chipField(info, "Playlists");

  // "VINYL" is the vinyl playlist.
  await chipInput(playlists).fill("VINYL");
  await expect(playlists.getByRole("button", { name: "Add", exact: true })).toBeVisible();
  await chipInput(playlists).press("Enter");
  await assertChips(playlists, ["focus", "vinyl"]);

  // Another name makes a new playlist.
  await chipInput(playlists).fill("Late Night");
  await playlists.getByRole("button", { name: "New playlist “Late Night”" }).click();
  await assertChips(playlists, ["focus", "vinyl", "Late Night"]);

  // No primary playlist: none is highlighted, none can be promoted.
  await expect(playlists.locator(".chip.primary")).toHaveCount(0);
  await expect(playlists.getByRole("button", { name: "vinyl", exact: true })).toHaveCount(0);

  // The × and Backspace remove playlists, like genres.
  await playlists.getByRole("button", { name: "Remove focus" }).click();
  await chipInput(playlists).press("Backspace");
  await assertChips(playlists, ["vinyl"]);
  await addChip(playlists, "Late Night");

  await info.getByRole("button", { name: "OK" }).click();
  await assertSources(page, ["Music", "Recently Added", "Late Night", "vinyl"]);
  await selectSource(page, "vinyl");
  await assertShownAlbums(page, ["Selected Ambient Works", "Donuts"]);
});
