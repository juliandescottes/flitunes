import { expect, test, type Page } from "@playwright/test";
import { FakeSpotify, signInToSpotify, trackUri, type FakeAlbum } from "../spotify.ts";
import {
  album,
  albumRow,
  assertShownAlbums,
  assertTracks,
  clickAlbum,
  column,
  genre,
  openApp,
  pickInColumn,
  searchFor,
  selectSource,
  trackList,
  trackRow,
} from "../testutils.ts";

const JAZZ = genre("Jazz");

// Spotify ids.
const KIND_OF_BLUE = "1weenld61qoidwYuZ1GESA";
const LIVE = "5Wa5GGSR2rSC4CmqsMFSf0";
const SKETCHES = "0Hs3BomCdwIWRhgT57x22T";
const EMPTY = "4m2880jivSbbyEGAKfITCa";
const PLAYLIST = "37i9dQZF1DXbITWG1ZJKYt";

const SPOTIFY_ALBUMS: Record<string, FakeAlbum> = {
  [KIND_OF_BLUE]: {
    name: "Kind of Blue",
    artists: ["Miles Davis"],
    tracks: [
      { name: "So What", seconds: 562 },
      { name: "Freddie Freeloader", seconds: 586 },
      // With a guest.
      { name: "Blue in Green", seconds: 337, artists: ["Miles Davis", "Bill Evans"] },
    ],
  },
  // On two discs.
  [LIVE]: {
    name: "Live at the Plugged Nickel",
    artists: ["Miles Davis"],
    tracks: [
      { name: "If I Were a Bell", seconds: 975, disc: 1 },
      { name: "Stella by Starlight", seconds: 734, disc: 1 },
      { name: "Walkin'", seconds: 657, disc: 2 },
    ],
  },
  // No year in the library: Spotify's release date gives it.
  [SKETCHES]: { name: "Sketches of Spain", artists: ["Miles Davis"], releaseDate: "1960-07-18", tracks: [{ name: "Solea", seconds: 735 }] },
  [EMPTY]: { name: "Unreleased", artists: ["Miles Davis"], tracks: [] },
};

const LIBRARY = {
  genres: [JAZZ],
  albums: [
    album({ title: "Kind of Blue", artists: ["Miles Davis"], year: 1959, genres: [JAZZ.id], spotify: `spotify:album:${KIND_OF_BLUE}` }),
    album({ title: "Live at the Plugged Nickel", artists: ["Miles Davis"], year: 1965, spotify: `spotify:album:${LIVE}` }),
    album({ title: "Sketches of Spain", artists: ["Miles Davis"], genres: [JAZZ.id], spotify: `spotify:album:${SKETCHES}` }),
    album({ title: "Unreleased", artists: ["Miles Davis"], year: 1970, spotify: `spotify:album:${EMPTY}` }),
    album({ title: "Jazz Classics", artists: ["Various Artists"], spotify: `spotify:playlist:${PLAYLIST}` }),
    album({ title: "Bootleg", artists: ["Miles Davis"], year: 1969 }),
  ],
};

async function openSignedIn(page: Page, spotify = new FakeSpotify(SPOTIFY_ALBUMS), address = "/") {
  await signInToSpotify(page, spotify);
  await openApp(page, LIBRARY, address);
  return spotify;
}

/** Double-clicks an album in the list. */
async function openAlbum(page: Page, title: string) {
  await albumRow(page, title).locator("td.artist").dblclick();
}

/** The album menu's items, and which are enabled. */
async function assertAlbumMenu(page: Page, title: string, items: [string, boolean][]) {
  await albumRow(page, title).locator("td.artist").click({ button: "right" });
  const menuItems = page.getByRole("menu").getByRole("menuitem");
  await expect(menuItems).toHaveText(items.map(([name]) => name));
  for (const [name, enabled] of items) {
    const item = page.getByRole("menu").getByRole("menuitem", { name, exact: true });
    await (enabled ? expect(item).toBeEnabled() : expect(item).toBeDisabled());
  }
  await page.keyboard.press("Escape");
}

test("Opening an album lists its tracks, from Spotify", { tag: ["@spotify.tracks", "@browsing.open"] }, async ({ page }) => {
  await openSignedIn(page);

  await openAlbum(page, "Kind of Blue");
  const tracks = trackList(page, "Kind of Blue");
  await expect(page.getByRole("heading", { name: "Kind of Blue" })).toBeVisible();
  // 9:22 + 9:46 + 5:37.
  await expect(page.getByText("1959 · 3 songs · 24:45")).toBeVisible();
  await assertTracks(page, "Kind of Blue", [
    ["1", "So What", "9:22", "Miles Davis", "Kind of Blue", "Jazz", "1959"],
    ["2", "Freddie Freeloader", "9:46", "Miles Davis", "Kind of Blue", "Jazz", "1959"],
    ["3", "Blue in Green", "5:37", "Miles Davis, Bill Evans", "Kind of Blue", "Jazz", "1959"],
  ]);
  await expect(tracks).toBeFocused();
});

test("Enter or Show Tracks open an album too", { tag: ["@spotify.tracks", "@browsing.open", "@spotify.album-menu"] }, async ({ page }) => {
  await openSignedIn(page);

  await clickAlbum(page, "Kind of Blue");
  await page.keyboard.press("Enter");
  await expect(trackList(page, "Kind of Blue")).toBeVisible();
  await page.keyboard.press("Escape");

  await albumRow(page, "Sketches of Spain").locator("td.artist").click({ button: "right" });
  await page.getByRole("menu").getByRole("menuitem", { name: "Show Tracks" }).click();
  await expect(trackList(page, "Sketches of Spain")).toBeVisible();
});

test("Albums on several discs are split by disc, and Spotify gives a missing year", { tag: ["@spotify.tracks"] }, async ({ page }) => {
  await openSignedIn(page);

  await openAlbum(page, "Live at the Plugged Nickel");
  await assertTracks(page, "Live at the Plugged Nickel", [
    ["Disc 1"],
    ["1", "If I Were a Bell", "16:15", "Miles Davis", "Live at the Plugged Nickel", "", "1965"],
    ["2", "Stella by Starlight", "12:14", "Miles Davis", "Live at the Plugged Nickel", "", "1965"],
    ["Disc 2"],
    ["1", "Walkin'", "10:57", "Miles Davis", "Live at the Plugged Nickel", "", "1965"],
  ]);

  await page.keyboard.press("Escape");
  await openAlbum(page, "Sketches of Spain");
  await expect(page.getByText("1960 · 1 song · 12:15")).toBeVisible();
  await assertTracks(page, "Sketches of Spain", [["1", "Solea", "12:15", "Miles Davis", "Sketches of Spain", "Jazz", "1960"]]);
});

test("A track plays the album from there, and the playing track is marked", { tag: ["@spotify.tracks-play"] }, async ({ page }) => {
  const spotify = await openSignedIn(page);
  await openAlbum(page, "Kind of Blue");

  // Double-click.
  await trackRow(page, "Kind of Blue", "Freddie Freeloader").dblclick();
  await expect.poll(() => spotify.commands.at(-1)?.body).toEqual({
    context_uri: `spotify:album:${KIND_OF_BLUE}`,
    offset: { uri: trackUri(KIND_OF_BLUE, 1) },
  });
  await expect(trackRow(page, "Kind of Blue", "Freddie Freeloader").getByRole("img")).toHaveAccessibleName("Playing");
  await expect(trackList(page, "Kind of Blue").getByRole("img")).toHaveCount(1);

  // Arrows, then Enter: the third track.
  await trackList(page, "Kind of Blue").focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(trackRow(page, "Kind of Blue", "Blue in Green").getByRole("img")).toHaveAccessibleName("Playing");

  // Paused.
  await page.getByRole("group", { name: "Playback" }).getByRole("button", { name: "Pause" }).click();
  await expect(trackRow(page, "Kind of Blue", "Blue in Green").getByRole("img")).toHaveAccessibleName("Paused");

  // The cover's button: from the start.
  await page.getByRole("button", { name: "Play Kind of Blue" }).click();
  await expect.poll(() => spotify.commands.at(-1)?.body).toEqual({ context_uri: `spotify:album:${KIND_OF_BLUE}` });
  await expect(trackRow(page, "Kind of Blue", "So What").getByRole("img")).toHaveAccessibleName("Playing");
});

test("Escape, Back, a source, a column pick or a search go back to the list", { tag: ["@spotify.tracks-back", "@navigation.back-forward"] }, async ({ page }) => {
  await openSignedIn(page);
  // Sorted by artist, then year (none last): Miles Davis's, then Various Artists.
  const list = ["Kind of Blue", "Live at the Plugged Nickel", "Bootleg", "Unreleased", "Sketches of Spain", "Jazz Classics"];

  // Escape.
  await openAlbum(page, "Kind of Blue");
  await page.keyboard.press("Escape");
  await expect(trackList(page, "Kind of Blue")).toBeHidden();
  await assertShownAlbums(page, list);

  // The browser's Back.
  await openAlbum(page, "Kind of Blue");
  await page.goBack();
  await expect(trackList(page, "Kind of Blue")).toBeHidden();
  await assertShownAlbums(page, list);

  // A source.
  await openAlbum(page, "Kind of Blue");
  await selectSource(page, "Music");
  await assertShownAlbums(page, list);

  // A column pick.
  await openAlbum(page, "Kind of Blue");
  await pickInColumn(page, "Genres", "Jazz");
  await assertShownAlbums(page, ["Kind of Blue", "Sketches of Spain"]);

  // A search.
  await openAlbum(page, "Kind of Blue");
  await searchFor(page, "sketches");
  await assertShownAlbums(page, ["Sketches of Spain"]);
});

test("The tracks shown are part of the address", { tag: ["@navigation.address"] }, async ({ page }) => {
  await openSignedIn(page);
  await openAlbum(page, "Kind of Blue");
  await expect.poll(() => new URL(page.url()).hash).toMatch(/^#\/music\?tracks=ALBUM\d+$/);

  await page.reload();
  await expect(trackList(page, "Kind of Blue")).toBeVisible();
});

test("Tracks that can't be fetched, or an album without tracks, say so", { tag: ["@spotify.tracks-errors"] }, async ({ page }) => {
  const spotify = new FakeSpotify(SPOTIFY_ALBUMS);
  spotify.failingTracks.add(KIND_OF_BLUE);
  await openSignedIn(page, spotify);

  await openAlbum(page, "Kind of Blue");
  await expect(page.getByText("Couldn't load the tracks: Spotify: Server error")).toBeVisible();

  // Escape needs tracks: back with the browser's Back.
  await page.goBack();
  await openAlbum(page, "Unreleased");
  await expect(page.getByText("Spotify lists no tracks for this album.")).toBeVisible();
});

test("Signed in, the album menu has Play and Show Tracks when they apply", { tag: ["@spotify.album-menu"] }, async ({ page }) => {
  await openSignedIn(page);

  await assertAlbumMenu(page, "Kind of Blue", [
    ["Get Info", true],
    ["Play", true],
    ["Show Tracks", true],
    ["Open in Spotify", true],
    ["Delete from Library", true],
  ]);
  // A playlist has no track list.
  await assertAlbumMenu(page, "Jazz Classics", [
    ["Get Info", true],
    ["Play", true],
    ["Show Tracks", false],
    ["Open in Spotify", true],
    ["Delete from Library", true],
  ]);
  // No link.
  await assertAlbumMenu(page, "Bootleg", [
    ["Get Info", true],
    ["Play", false],
    ["Show Tracks", false],
    ["Open in Spotify", false],
    ["Delete from Library", true],
  ]);
  // Several albums. ⌘-click adds to the selection.
  await clickAlbum(page, "Kind of Blue");
  await clickAlbum(page, "Sketches of Spain", ["ControlOrMeta"]);
  await assertAlbumMenu(page, "Sketches of Spain", [
    ["Get Info (Multiple Items)", true],
    ["Play", false],
    ["Show Tracks", false],
    ["Open in Spotify", false],
    ["Delete 2 Albums", true],
  ]);
});

test("Signed out, the album menu has neither", { tag: ["@spotify.album-menu"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  await assertAlbumMenu(page, "Kind of Blue", [
    ["Get Info", true],
    ["Open in Spotify", true],
    ["Delete from Library", true],
  ]);
});

test("Double-clicking a title in the Albums column lists its tracks", { tag: ["@browsing.column-open-album"] }, async ({ page }) => {
  await openSignedIn(page);

  await column(page, "Albums").getByRole("option", { name: "Kind of Blue", exact: true }).dblclick();
  await expect(trackList(page, "Kind of Blue")).toBeVisible();
});
