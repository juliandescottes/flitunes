import { expect, test } from "@playwright/test";
import {
  addChip,
  album,
  albumCell,
  assertRating,
  assertShownAlbums,
  chipField,
  clickAlbum,
  genre,
  infoField,
  openApp,
  openGetInfo,
  selectSource,
} from "../testutils.ts";

const KRAUTROCK = genre("Krautrock");

const LIBRARY = {
  genres: [KRAUTROCK],
  albums: [
    album({ title: "Tago Mago", artists: ["Can"], year: 1971, genres: [KRAUTROCK.id], tags: ["vinyl", "chill"] }),
    album({ title: "Ege Bamyasi", artists: ["Can"], year: 1972, genres: [KRAUTROCK.id], tags: ["chill"] }),
    album({ title: "Neu!", artists: ["Neu!"], year: 1972 }),
  ],
};

test("Only the edited fields are applied to every album", { tag: ["@album-editing.multi-apply"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await clickAlbum(page, "Tago Mago");
  await clickAlbum(page, "Ege Bamyasi", ["ControlOrMeta"]);
  const info = await openGetInfo(page);
  const apply = (field: string) => info.getByRole("checkbox", { name: `Apply ${field}` });

  // Shared values show, differing ones are "Mixed".
  await expect(infoField(info, "Artist")).toHaveValue("Can");
  await expect(infoField(info, "Year")).toHaveValue("");
  await expect(infoField(info, "Year")).toHaveAttribute("placeholder", "Mixed");
  await expect(infoField(info, "Sort Artist")).toHaveAttribute("placeholder", "");

  // Nothing is ticked until a field is edited.
  for (const field of ["artist", "sort artist", "year", "genres", "rating"]) {
    await expect(apply(field)).not.toBeChecked();
  }
  await infoField(info, "Year").fill("1973");
  await expect(apply("year")).toBeChecked();
  await info.getByRole("radio", { name: "5 stars" }).click();
  await expect(apply("rating")).toBeChecked();

  // An edited field that is unticked again isn't applied.
  await infoField(info, "Artist").fill("The Can");
  await expect(apply("artist")).toBeChecked();
  await apply("artist").uncheck();

  await info.getByRole("button", { name: "OK" }).click();
  await expect(info).toBeHidden();

  // Year and rating changed on both, the artist on neither, and Neu! is untouched.
  for (const title of ["Tago Mago", "Ege Bamyasi"]) {
    await expect(albumCell(page, title, "Year")).toHaveText("1973");
    await expect(albumCell(page, title, "Artist")).toHaveText("Can");
    await assertRating(page, title, 5);
  }
  await expect(albumCell(page, "Neu!", "Year")).toHaveText("1972");
  await assertRating(page, "Neu!", 0);
});

test("Add to and Remove from change the playlists of every album", { tag: ["@album-editing.multi-playlists"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await clickAlbum(page, "Tago Mago");
  await clickAlbum(page, "Neu!", ["Shift"]);
  const info = await openGetInfo(page);

  await addChip(chipField(info, "Add to"), "favorites");
  await addChip(chipField(info, "Remove from"), "chill");
  await info.getByRole("button", { name: "OK" }).click();
  await expect(info).toBeHidden();

  await selectSource(page, "favorites");
  await assertShownAlbums(page, ["Tago Mago", "Ege Bamyasi", "Neu!"]);

  // No album is left in chill, so the playlist is gone; vinyl is untouched.
  await expect(page.getByRole("navigation", { name: "Sources" }).getByRole("button", { name: "chill" })).toHaveCount(0);
  await selectSource(page, "vinyl");
  await assertShownAlbums(page, ["Tago Mago"]);
});
