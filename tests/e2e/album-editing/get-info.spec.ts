import { expect, test } from "@playwright/test";
import {
  album,
  albumCell,
  albumMenu,
  albumRow,
  assertChips,
  assertColumn,
  assertDisplay,
  assertRating,
  assertSelectedAlbums,
  assertShownAlbums,
  chipField,
  clickAlbum,
  genre,
  infoField,
  infoWindow,
  openApp,
  openGetInfo,
} from "../testutils.ts";

const JAZZ = genre("Jazz");
const ROCK = genre("Rock");

const BLUE_TRAIN = album({
  title: "Blue Train",
  artists: ["John Coltrane"],
  artistSort: "Coltrane, John",
  year: 1957,
  genres: [JAZZ.id],
  tags: ["vinyl"],
  rating: 4,
  notes: "Blue Note 1577",
  spotify: "spotify:album:1weenld61qoidwYuZ1GESA",
});
const EGE_BAMYASI = album({ title: "Ege Bamyasi", artists: ["Can"], year: 1972, genres: [ROCK.id] });
const MOON_SAFARI = album({ title: "Moon Safari", artists: ["Air"], year: 1998 });

const LIBRARY = { genres: [JAZZ, ROCK], albums: [BLUE_TRAIN, EGE_BAMYASI, MOON_SAFARI] };

test("Cmd+I or the context menu opens Get Info for the selection", { tag: ["@album-editing.open"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  // One album: its own window.
  await clickAlbum(page, "Ege Bamyasi");
  const info = await openGetInfo(page);
  await expect(info.locator(".titlebar")).toHaveText("Ege Bamyasi");
  await expect(infoField(info, "Name")).toHaveValue("Ege Bamyasi");
  await info.getByRole("button", { name: "Cancel" }).click();
  await expect(info).toBeHidden();

  // Several albums: Multiple Item Information.
  await clickAlbum(page, "Moon Safari", ["ControlOrMeta"]);
  await openGetInfo(page);
  await expect(info.locator(".titlebar")).toHaveText("Multiple Item Information");
  await expect(info.getByText("Editing 2 albums.")).toBeVisible();
  await info.getByRole("button", { name: "Cancel" }).click();

  // Right-clicking outside the selection selects that album first.
  await albumMenu(page, "Blue Train", "Get Info");
  await assertSelectedAlbums(page, ["Blue Train"]);
  await expect(info.locator(".titlebar")).toHaveText("Blue Train");
});

test("The Info tab shows every field of the album", { tag: ["@album-editing.fields"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await clickAlbum(page, "Blue Train");
  const info = await openGetInfo(page);

  await expect(infoField(info, "Name")).toHaveValue("Blue Train");
  await expect(infoField(info, "Artist")).toHaveValue("John Coltrane");
  await expect(infoField(info, "Sort Artist")).toHaveValue("Coltrane, John");
  await expect(infoField(info, "Year")).toHaveValue("1957");
  await assertChips(chipField(info, "Genres"), ["Jazz"]);
  await expect(info.getByRole("radio", { name: "4 stars" })).toHaveAttribute("aria-checked", "true");
  await assertChips(chipField(info, "Playlists"), ["vinyl"]);
  await expect(infoField(info, "Spotify")).toHaveValue("https://open.spotify.com/album/1weenld61qoidwYuZ1GESA");
  await expect(infoField(info, "Comments")).toHaveValue("Blue Note 1577");
});

test("Several artists are separated by semicolons", { tag: ["@album-editing.fields"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await clickAlbum(page, "Blue Train");
  const info = await openGetInfo(page);

  await infoField(info, "Artist").fill("John Coltrane; Lee Morgan");
  await info.getByRole("button", { name: "OK" }).click();

  // Each artist is listed on its own in the column browser.
  await expect(albumCell(page, "Blue Train", "Artist")).toHaveText("John Coltrane, Lee Morgan");
  await assertColumn(page, "Artists", ["All (4 Artists)", "Air", "Can", "John Coltrane", "Lee Morgan"]);

  // And shown the same way when the window opens again.
  await openGetInfo(page);
  await expect(infoField(info, "Artist")).toHaveValue("John Coltrane; Lee Morgan");
});

test("OK or Enter applies the edits, and they are kept", { tag: ["@album-editing.ok-cancel"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await clickAlbum(page, "Moon Safari");

  // OK.
  let info = await openGetInfo(page);
  await infoField(info, "Name").fill("Talkie Walkie");
  await infoField(info, "Year").fill("2004");
  await info.getByRole("button", { name: "OK" }).click();
  await expect(info).toBeHidden();
  await assertShownAlbums(page, ["Talkie Walkie", "Ege Bamyasi", "Blue Train"]);
  await expect(albumCell(page, "Talkie Walkie", "Year")).toHaveText("2004");
  await assertDisplay(page, "Talkie Walkie", "Air — 2004");

  // Enter in a field.
  info = await openGetInfo(page);
  await infoField(info, "Year").fill("2005");
  await infoField(info, "Year").press("Enter");
  await expect(info).toBeHidden();
  await expect(albumCell(page, "Talkie Walkie", "Year")).toHaveText("2005");

  // Still there after a reload.
  await page.reload();
  await assertShownAlbums(page, ["Talkie Walkie", "Ege Bamyasi", "Blue Train"]);
  await expect(albumCell(page, "Talkie Walkie", "Year")).toHaveText("2005");
});

test("Cancel, the close button and Escape discard the edits", { tag: ["@album-editing.ok-cancel"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await clickAlbum(page, "Moon Safari");
  const info = infoWindow(page);

  for (const close of [
    () => info.getByRole("button", { name: "Cancel" }).click(),
    () => info.getByRole("button", { name: "Close" }).click(),
    () => page.keyboard.press("Escape"),
  ]) {
    await openGetInfo(page);
    await infoField(info, "Name").fill("Talkie Walkie");
    await close();
    await expect(info).toBeHidden();
    await assertShownAlbums(page, ["Moon Safari", "Ege Bamyasi", "Blue Train"]);
  }

  // The window starts from the album again.
  await openGetInfo(page);
  await expect(infoField(info, "Name")).toHaveValue("Moon Safari");
});

test("Name and Artist can't be empty", { tag: ["@album-editing.required"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await clickAlbum(page, "Moon Safari");
  const info = await openGetInfo(page);

  for (const field of ["Name", "Artist"]) {
    await infoField(info, field).fill("");
    await info.getByRole("button", { name: "OK" }).click();
    await expect(info).toBeVisible();
    await info.getByRole("button", { name: "Cancel" }).click();
    await assertShownAlbums(page, ["Moon Safari", "Ege Bamyasi", "Blue Train"]);
    await expect(albumCell(page, "Moon Safari", "Artist")).toHaveText("Air");
    await openGetInfo(page);
  }
});

test("The year must be a whole number, or empty", { tag: ["@album-editing.year"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await clickAlbum(page, "Moon Safari");
  const info = await openGetInfo(page);

  // Not a number: nothing is applied, not even the other fields.
  await infoField(info, "Name").fill("Talkie Walkie");
  await infoField(info, "Year").fill("1998.5");
  await info.getByRole("button", { name: "OK" }).click();
  await expect(info.getByText("Year must be a number")).toBeVisible();
  await expect(info).toBeVisible();
  await info.getByRole("button", { name: "Cancel" }).click();
  await assertShownAlbums(page, ["Moon Safari", "Ege Bamyasi", "Blue Train"]);
  await expect(albumCell(page, "Moon Safari", "Year")).toHaveText("1998");

  // Empty: no year.
  await openGetInfo(page);
  await infoField(info, "Year").fill("");
  await info.getByRole("button", { name: "OK" }).click();
  await expect(info).toBeHidden();
  await expect(albumCell(page, "Moon Safari", "Year")).toHaveText("");
});

test("The Spotify field takes album and playlist links only", { tag: ["@album-editing.spotify-link"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  const openInSpotify = albumRow(page, "Moon Safari").getByRole("button", { name: "Open in Spotify" });
  await expect(openInSpotify).toHaveCount(0);
  await clickAlbum(page, "Moon Safari");
  const info = await openGetInfo(page);

  // A track link is refused.
  await infoField(info, "Spotify").fill("https://open.spotify.com/track/2takcwOaAZWiXQijPHIx7B");
  await info.getByRole("button", { name: "OK" }).click();
  await expect(info.getByText("The Spotify link is not an album or playlist link.")).toBeVisible();
  await info.getByRole("button", { name: "Cancel" }).click();
  await expect(openInSpotify).toHaveCount(0);

  // An album URI is taken, and shown as a web link.
  await openGetInfo(page);
  await infoField(info, "Spotify").fill("spotify:album:5zDemkExm0RxyQ6zXhuW3S");
  await info.getByRole("button", { name: "OK" }).click();
  await expect(info).toBeHidden();
  await expect(openInSpotify).toHaveCount(1);
  await openGetInfo(page);
  await expect(infoField(info, "Spotify")).toHaveValue("https://open.spotify.com/album/5zDemkExm0RxyQ6zXhuW3S");

  // So is a playlist address.
  await infoField(info, "Spotify").fill("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc");
  await info.getByRole("button", { name: "OK" }).click();
  await expect(info).toBeHidden();
  await openGetInfo(page);
  await expect(infoField(info, "Spotify")).toHaveValue("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M");

  // Empty removes the link.
  await infoField(info, "Spotify").fill("");
  await info.getByRole("button", { name: "OK" }).click();
  await expect(info).toBeHidden();
  await expect(openInSpotify).toHaveCount(0);
});

test("Previous and Next apply the edits and walk the main view", { tag: ["@album-editing.previous-next"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await assertShownAlbums(page, ["Moon Safari", "Ege Bamyasi", "Blue Train"]);
  await clickAlbum(page, "Moon Safari");
  const info = await openGetInfo(page);

  // First album: no Previous.
  await expect(info.getByRole("button", { name: "Previous" })).toBeDisabled();

  // Next applies the rating and moves on.
  await info.getByRole("radio", { name: "3 stars" }).click();
  await info.getByRole("button", { name: "Next" }).click();
  await expect(info.locator(".titlebar")).toHaveText("Ege Bamyasi");
  await expect(infoField(info, "Name")).toHaveValue("Ege Bamyasi");
  await assertSelectedAlbums(page, ["Ege Bamyasi"]);
  await assertRating(page, "Moon Safari", 3);

  await info.getByRole("button", { name: "Next" }).click();
  await expect(info.locator(".titlebar")).toHaveText("Blue Train");
  await assertSelectedAlbums(page, ["Blue Train"]);

  // Last album: no Next.
  await expect(info.getByRole("button", { name: "Next" })).toBeDisabled();

  // Previous applies the edits too.
  await infoField(info, "Year").fill("1958");
  await info.getByRole("button", { name: "Previous" }).click();
  await expect(info.locator(".titlebar")).toHaveText("Ege Bamyasi");
  await assertSelectedAlbums(page, ["Ege Bamyasi"]);
  await expect(albumCell(page, "Blue Train", "Year")).toHaveText("1958");
});
