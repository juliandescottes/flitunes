import { expect, test, type Page } from "@playwright/test";
import { FakeSpotify, signInToSpotify, type FakeAlbum } from "../spotify.ts";
import {
  album,
  albumMenu,
  albumRow,
  rowPlayButton,
  assertDisplay,
  assertDisplayTimes,
  clickAlbum,
  focusMainView,
  genre,
  openApp,
  openGetInfo,
  searchField,
  switchView,
  trackList,
} from "../testutils.ts";

const JAZZ = genre("Jazz");

// Spotify ids.
const KIND_OF_BLUE = "1weenld61qoidwYuZ1GESA";
const BLUE_TRAIN = "7Ln5ALD8BTYX7E1R2fHDsN";
const PLAYLIST = "37i9dQZF1DXbITWG1ZJKYt";
const OTHER_PLAYLIST = "37i9dQZF1DX4wta20PHgwo";
const NOT_IN_LIBRARY = "2guirTSEqLizK7j9i1MTTZ";

const SPOTIFY_ALBUMS: Record<string, FakeAlbum> = {
  [KIND_OF_BLUE]: {
    name: "Kind of Blue",
    artists: ["Miles Davis"],
    tracks: [
      { name: "So What", seconds: 562 },
      { name: "Freddie Freeloader", seconds: 586 },
      { name: "Blue in Green", seconds: 337 },
    ],
  },
  [BLUE_TRAIN]: { name: "Blue Train", artists: ["John Coltrane"], tracks: [{ name: "Blue Train", seconds: 643 }] },
  [NOT_IN_LIBRARY]: { name: "Giant Steps", artists: ["John Coltrane"], tracks: [{ name: "Giant Steps", seconds: 286 }] },
};

const LIBRARY = {
  genres: [JAZZ],
  albums: [
    album({ title: "Kind of Blue", artists: ["Miles Davis"], year: 1959, genres: [JAZZ.id], spotify: `spotify:album:${KIND_OF_BLUE}` }),
    album({ title: "Blue Train", artists: ["John Coltrane"], year: 1957, genres: [JAZZ.id], spotify: `spotify:album:${BLUE_TRAIN}` }),
    // Only on Spotify as a playlist.
    album({ title: "Jazz Classics", artists: ["Various Artists"], spotify: `spotify:playlist:${PLAYLIST}` }),
  ],
};

/** The play commands Spotify received, as their address and what they played. */
function playCommands(spotify: FakeSpotify) {
  return spotify.commands.filter((c) => c.call.startsWith("PUT /me/player/play")).map((c) => [c.call, (c.body as { context_uri?: string } | null)?.context_uri]);
}

function transportButton(page: Page, name: "Previous" | "Play" | "Pause" | "Next") {
  return page.getByRole("group", { name: "Playback" }).getByRole("button", { name, exact: true });
}

async function devicesMenu(page: Page) {
  await page.getByRole("button", { name: "Devices" }).click();
  return page.getByRole("menu");
}

test("The play button plays the album on the active device", { tag: ["@spotify.play", "@spotify.now-playing", "@browsing.play-button"] }, async ({ page }) => {
  const spotify = new FakeSpotify(SPOTIFY_ALBUMS);
  await signInToSpotify(page, spotify);
  await openApp(page, LIBRARY);

  const play = await rowPlayButton(page, "Kind of Blue");
  await expect(play).toHaveAccessibleName("Play");
  await play.click();
  await expect.poll(() => playCommands(spotify)).toEqual([["PUT /me/player/play", `spotify:album:${KIND_OF_BLUE}`]]);
  await assertDisplay(page, "So What", "Miles Davis — Kind of Blue");

  // The grid's button, over the cover.
  await switchView(page, "Grid");
  const cover = page.getByRole("region", { name: "Albums" }).getByRole("option").filter({ hasText: "Blue Train" });
  await cover.hover();
  await cover.getByRole("button", { name: "Play Blue Train" }).click();
  await assertDisplay(page, "Blue Train", "John Coltrane — Blue Train");
});

test("Signed out, the play buttons open the Spotify app instead", { tag: ["@browsing.play-button"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  await expect(await rowPlayButton(page, "Kind of Blue")).toHaveAccessibleName("Open in Spotify");
  await switchView(page, "Grid");
  await expect(page.getByRole("button", { name: "Open Kind of Blue in Spotify" })).toBeAttached();
});

test("Play in the menu, or opening an album linked to a playlist, plays it", { tag: ["@spotify.play", "@browsing.open"] }, async ({ page }) => {
  const spotify = new FakeSpotify(SPOTIFY_ALBUMS);
  await signInToSpotify(page, spotify);
  await openApp(page, LIBRARY);

  await albumMenu(page, "Blue Train", "Play");
  await expect.poll(() => playCommands(spotify)).toEqual([["PUT /me/player/play", `spotify:album:${BLUE_TRAIN}`]]);

  // A playlist has no track list: double-click plays it.
  await albumRow(page, "Jazz Classics").locator("td.artist").dblclick();
  await expect.poll(() => playCommands(spotify).at(-1)).toEqual(["PUT /me/player/play", `spotify:playlist:${PLAYLIST}`]);
  await expect(trackList(page, "Jazz Classics")).toBeHidden();
});

test("Without an active device, Play goes to the picked device, else the first one", { tag: ["@spotify.no-device"] }, async ({ page }) => {
  const spotify = new FakeSpotify(SPOTIFY_ALBUMS);
  spotify.devices = [
    { id: "laptop", name: "Laptop", isActive: false },
    { id: "phone", name: "Phone", isActive: false },
  ];
  await signInToSpotify(page, spotify);
  await openApp(page, LIBRARY);

  // Spotify refuses the first try: it's sent again to the first device.
  await albumMenu(page, "Kind of Blue", "Play");
  await expect.poll(() => playCommands(spotify)).toEqual([
    ["PUT /me/player/play", `spotify:album:${KIND_OF_BLUE}`],
    ["PUT /me/player/play?device_id=laptop", `spotify:album:${KIND_OF_BLUE}`],
  ]);
  await assertDisplay(page, "So What", "Miles Davis — Kind of Blue");

  // Phone picked in FliTunes, then nothing active again: Play goes to the phone.
  await (await devicesMenu(page)).getByRole("menuitemradio", { name: "Phone" }).click();
  await expect.poll(() => spotify.devices.find((d) => d.isActive)?.id).toBe("phone");
  // Remembered once Spotify took it.
  await expect.poll(() => page.evaluate(() => localStorage.getItem("album-library:spotify-device"))).toBe("phone");
  spotify.devices = spotify.devices.map((d) => ({ ...d, isActive: false }));
  spotify.commands = [];
  await albumMenu(page, "Blue Train", "Play");
  await expect.poll(() => playCommands(spotify).at(-1)).toEqual(["PUT /me/player/play?device_id=phone", `spotify:album:${BLUE_TRAIN}`]);
});

test("With no device at all, Play says to open Spotify first", { tag: ["@spotify.no-device"] }, async ({ page }) => {
  const spotify = new FakeSpotify(SPOTIFY_ALBUMS);
  spotify.devices = [];
  await signInToSpotify(page, spotify);
  await openApp(page, LIBRARY);

  await albumMenu(page, "Kind of Blue", "Play");
  await expect(page.getByText("Open Spotify on one of your devices first, then try again.")).toBeVisible();
});

test("The playback buttons pause, play and change tracks", { tag: ["@spotify.transport", "@spotify.now-playing"] }, async ({ page }) => {
  const spotify = new FakeSpotify(SPOTIFY_ALBUMS);
  spotify.playing = { albumId: KIND_OF_BLUE, contextUri: `spotify:album:${KIND_OF_BLUE}`, track: 0, isPlaying: true };
  await signInToSpotify(page, spotify);
  await openApp(page, LIBRARY);
  await assertDisplay(page, "So What", "Miles Davis — Kind of Blue");

  await transportButton(page, "Pause").click();
  await expect(transportButton(page, "Play")).toBeVisible();
  expect(spotify.playing.isPlaying).toBe(false);
  // Paused at the start: 9:22 left.
  await assertDisplayTimes(page, "0:00", "-9:22");

  await transportButton(page, "Next").click();
  await assertDisplay(page, "Freddie Freeloader", "Miles Davis — Kind of Blue");
  await transportButton(page, "Previous").click();
  await assertDisplay(page, "So What", "Miles Davis — Kind of Blue");
  await transportButton(page, "Play").click();
  await expect(transportButton(page, "Pause")).toBeVisible();
});

test("Space and ⌘ arrows control playback, except while typing or editing", { tag: ["@spotify.transport"] }, async ({ page }) => {
  const spotify = new FakeSpotify(SPOTIFY_ALBUMS);
  spotify.playing = { albumId: KIND_OF_BLUE, contextUri: `spotify:album:${KIND_OF_BLUE}`, track: 0, isPlaying: true };
  await signInToSpotify(page, spotify);
  await openApp(page, LIBRARY);
  await focusMainView(page);

  await page.keyboard.press("Space");
  await expect(transportButton(page, "Play")).toBeVisible();
  // ⌘→ next track, ⌘← previous.
  await page.keyboard.press("ControlOrMeta+ArrowRight");
  await assertDisplay(page, "Freddie Freeloader", "Miles Davis — Kind of Blue");
  await page.keyboard.press("ControlOrMeta+ArrowLeft");
  await assertDisplay(page, "So What", "Miles Davis — Kind of Blue");

  // Typing a space in the search field.
  const commands = spotify.commands.length;
  await searchField(page).fill("blue");
  await searchField(page).press("Space");
  await expect(searchField(page)).toHaveValue("blue ");

  // Get Info open.
  await searchField(page).fill("");
  await clickAlbum(page, "Kind of Blue");
  await openGetInfo(page);
  await page.keyboard.press("ControlOrMeta+ArrowRight");
  await page.keyboard.press("Escape");

  // Neither sent anything to Spotify.
  await page.waitForTimeout(500);
  expect(spotify.commands.length).toBe(commands);
});

test("The Devices menu lists the devices and moves the playback", { tag: ["@spotify.devices"] }, async ({ page }) => {
  const spotify = new FakeSpotify(SPOTIFY_ALBUMS);
  spotify.devices = [
    { id: "laptop", name: "Laptop", isActive: true },
    { id: "phone", name: "Phone", isActive: false },
    { id: "speaker", name: "Kitchen Speaker", isActive: false, restricted: true },
  ];
  await signInToSpotify(page, spotify);
  await openApp(page, LIBRARY);

  const menu = await devicesMenu(page);
  await expect(menu.getByRole("menuitemradio")).toHaveText(["Laptop", "Phone", "Kitchen Speaker"]);
  await expect(menu.getByRole("menuitemradio", { checked: true })).toHaveText("Laptop");
  await expect(menu.getByRole("menuitemradio", { name: "Kitchen Speaker" })).toBeDisabled();

  await menu.getByRole("menuitemradio", { name: "Phone" }).click();
  await expect.poll(() => spotify.commands.map((c) => [c.call, c.body])).toEqual([["PUT /me/player", { device_ids: ["phone"], play: false }]]);
  await expect((await devicesMenu(page)).getByRole("menuitemradio", { checked: true })).toHaveText("Phone");
});

test("Without devices, the Devices menu says to open Spotify on one", { tag: ["@spotify.devices"] }, async ({ page }) => {
  const spotify = new FakeSpotify(SPOTIFY_ALBUMS);
  spotify.devices = [];
  await signInToSpotify(page, spotify);
  await openApp(page, LIBRARY);

  const menu = await devicesMenu(page);
  await expect(menu.getByRole("menuitem")).toHaveText(["No devices: open Spotify on one first"]);
  await expect(menu.getByRole("menuitem")).toBeDisabled();
});

test("What plays elsewhere shows within a few seconds", { tag: ["@spotify.now-playing"] }, async ({ page }) => {
  const spotify = new FakeSpotify(SPOTIFY_ALBUMS);
  await signInToSpotify(page, spotify);
  await openApp(page, LIBRARY);
  await assertDisplay(page, "FliTunes", "All changes saved");

  // Started from the phone's Spotify app.
  spotify.playing = { albumId: NOT_IN_LIBRARY, contextUri: `spotify:album:${NOT_IN_LIBRARY}`, track: 0, isPlaying: false };
  await expect(page.locator(".lcd-title")).toHaveText("Giant Steps", { timeout: 7000 });
  await assertDisplay(page, "Giant Steps", "John Coltrane — Giant Steps");
  await assertDisplayTimes(page, "0:00", "-4:46");
});

test("The display's disc shows the playing album's tracks, when it's in the library", { tag: ["@spotify.show-playing"] }, async ({ page }) => {
  const spotify = new FakeSpotify(SPOTIFY_ALBUMS);
  // Kind of Blue, played from a playlist that isn't in the library: found by the track's album.
  spotify.playing = { albumId: KIND_OF_BLUE, contextUri: `spotify:playlist:${OTHER_PLAYLIST}`, track: 1, isPlaying: true };
  await signInToSpotify(page, spotify);
  await openApp(page, LIBRARY);
  const disc = page.getByRole("button", { name: "Show the playing album's tracks" });

  await disc.click();
  await expect(trackList(page, "Kind of Blue")).toBeVisible();
  // Already shown.
  await expect(disc).toBeDisabled();

  // An album that isn't in the library.
  spotify.playing = { albumId: NOT_IN_LIBRARY, contextUri: `spotify:album:${NOT_IN_LIBRARY}`, track: 0, isPlaying: true };
  await transportButton(page, "Pause").click();
  await assertDisplay(page, "Giant Steps", "John Coltrane — Giant Steps");
  await expect(disc).toBeDisabled();
  await expect(disc).toHaveAttribute("title", "This album isn't in your library");
});
