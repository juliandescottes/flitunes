import { expect, test } from "@playwright/test";
import {
  album,
  assertColumn,
  assertColumnPick,
  assertShownAlbums,
  column,
  genre,
  openApp,
  pickInColumn,
  searchFor,
} from "../testutils.ts";

const ELECTRONIC = genre("Electronic");
const JAZZ = genre("Jazz");
const ROCK = genre("Rock");

const LIBRARY = {
  genres: [ELECTRONIC, JAZZ, ROCK],
  albums: [
    // Sorted under "Davis".
    album({ title: "Kind of Blue", artists: ["Miles Davis"], artistSort: "Davis, Miles", year: 1959, genres: [JAZZ.id] }),
    album({ title: "Bitches Brew", artists: ["Miles Davis"], artistSort: "Davis, Miles", year: 1970, genres: [JAZZ.id, ROCK.id] }),
    album({ title: "The Köln Concert", artists: ["Keith Jarrett"], year: 1975, genres: [JAZZ.id] }),
    // Two editions sharing a title, by an artist sorted under "Beatles".
    album({ title: "Abbey Road", artists: ["The Beatles"], year: 1969, genres: [ROCK.id] }),
    album({ title: "Abbey Road", artists: ["The Beatles"], year: 2019, genres: [ROCK.id] }),
    album({ title: "Kid A", artists: ["Radiohead"], year: 2000, genres: [ELECTRONIC.id, ROCK.id] }),
  ],
};

test(
  "The columns list the library's genres, artists and albums, in order",
  { tag: ["@browsing.columns", "@browsing.column-order", "@browsing.album-editions"] },
  async ({ page }) => {
    await openApp(page, LIBRARY);

    await assertColumn(page, "Genres", ["All (3 Genres)", "Electronic", "Jazz", "Rock"]);
    // "The Beatles" sorts as "Beatles", Miles Davis by his Sort Artist.
    await assertColumn(page, "Artists", ["All (4 Artists)", "The Beatles", "Miles Davis", "Keith Jarrett", "Radiohead"]);
    // The two Abbey Road editions are one entry; "The Köln Concert" sorts
    // as "Köln", after "Kind".
    await assertColumn(page, "Albums", ["All (5 Albums)", "Abbey Road", "Bitches Brew", "Kid A", "Kind of Blue", "The Köln Concert"]);
  },
);

test("All counts one entry in the singular", { tag: ["@browsing.columns"] }, async ({ page }) => {
  await openApp(page, {
    genres: [JAZZ],
    albums: [album({ title: "Blue Train", artists: ["John Coltrane"], genres: [JAZZ.id] })],
  });

  await assertColumn(page, "Genres", ["All (1 Genre)", "Jazz"]);
  await assertColumn(page, "Artists", ["All (1 Artist)", "John Coltrane"]);
  await assertColumn(page, "Albums", ["All (1 Album)", "Blue Train"]);
});

test("Picking a genre, then an artist, narrows the next columns and the albums", { tag: ["@browsing.column-narrowing"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  // Jazz.
  await pickInColumn(page, "Genres", "Jazz");
  await assertColumn(page, "Artists", ["All (2 Artists)", "Miles Davis", "Keith Jarrett"]);
  await assertColumn(page, "Albums", ["All (3 Albums)", "Bitches Brew", "Kind of Blue", "The Köln Concert"]);
  await assertShownAlbums(page, ["Kind of Blue", "Bitches Brew", "The Köln Concert"]);

  // Jazz by Miles Davis.
  await pickInColumn(page, "Artists", "Miles Davis");
  await assertColumn(page, "Albums", ["All (2 Albums)", "Bitches Brew", "Kind of Blue"]);
  await assertShownAlbums(page, ["Kind of Blue", "Bitches Brew"]);

  // One album.
  await pickInColumn(page, "Albums", "Kind of Blue");
  await assertShownAlbums(page, ["Kind of Blue"]);

  // Another genre resets the artist and album picks. Bitches Brew, filed
  // under Jazz and Rock, shows in both.
  await pickInColumn(page, "Genres", "Rock");
  await assertColumnPick(page, "Artists", "All (3 Artists)");
  await assertColumnPick(page, "Albums", "All (3 Albums)");
  await assertColumn(page, "Artists", ["All (3 Artists)", "The Beatles", "Miles Davis", "Radiohead"]);
  await assertShownAlbums(page, ["Abbey Road", "Abbey Road", "Bitches Brew", "Kid A"]);

  // Another artist resets the album pick.
  await pickInColumn(page, "Albums", "Kid A");
  await pickInColumn(page, "Artists", "The Beatles");
  await assertColumnPick(page, "Albums", "All (1 Album)");
  await assertShownAlbums(page, ["Abbey Road", "Abbey Road"]);
});

test("Picking a title shows all its editions", { tag: ["@browsing.album-editions"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  await pickInColumn(page, "Albums", "Abbey Road");
  await assertShownAlbums(page, ["Abbey Road", "Abbey Road"]);
});

test("A pick that is no longer listed counts as All", { tag: ["@browsing.stale-pick"] }, async ({ page }) => {
  await openApp(page, LIBRARY);

  await pickInColumn(page, "Genres", "Jazz");
  await assertShownAlbums(page, ["Kind of Blue", "Bitches Brew", "The Köln Concert"]);

  // Radiohead has no jazz album: the Jazz pick no longer applies.
  await searchFor(page, "radiohead");
  await assertColumn(page, "Genres", ["All (2 Genres)", "Electronic", "Rock"]);
  await assertColumnPick(page, "Genres", "All (2 Genres)");
  await assertShownAlbums(page, ["Kid A"]);
});

test("The arrow keys move the pick in a column", { tag: ["@browsing.column-keyboard"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await column(page, "Genres").focus();

  await page.keyboard.press("ArrowDown");
  await assertColumnPick(page, "Genres", "Electronic");
  await assertShownAlbums(page, ["Kid A"]);

  await page.keyboard.press("ArrowDown");
  await assertColumnPick(page, "Genres", "Jazz");

  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await assertColumnPick(page, "Genres", "All (3 Genres)");

  // Up stops at All.
  await page.keyboard.press("ArrowUp");
  await assertColumnPick(page, "Genres", "All (3 Genres)");
  await assertShownAlbums(page, ["Abbey Road", "Abbey Road", "Kind of Blue", "Bitches Brew", "The Köln Concert", "Kid A"]);
});

test("The column browser is resized from its bottom edge, and keeps its height", { tag: ["@browsing.column-resize"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  const edge = page.getByRole("separator", { name: "Resize the column browser" });
  // The height the edge reports to assistive tech.
  const browserHeight = async () => Number(await edge.getAttribute("aria-valuenow"));

  // 160 pixels by default.
  await expect.poll(browserHeight).toBe(160);

  // Dragging the edge down by 40 pixels.
  const box = (await edge.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 4 });
  await page.mouse.up();
  await expect.poll(browserHeight).toBe(200);

  // Arrows: 10 pixels, 50 with Shift.
  await edge.focus();
  await page.keyboard.press("ArrowUp");
  await expect.poll(browserHeight).toBe(190);
  await page.keyboard.press("Shift+ArrowDown");
  await expect.poll(browserHeight).toBe(240);

  // The album list keeps 100 pixels: the browser stops growing before.
  for (let i = 0; i < 20; i++) await page.keyboard.press("Shift+ArrowDown");
  const listHeight = await page.getByRole("region", { name: "Albums" }).evaluate((main) => main.getBoundingClientRect().height);
  expect(listHeight).toBeGreaterThanOrEqual(100);
  expect(listHeight).toBeLessThan(110);

  // Remembered after a reload.
  const height = await browserHeight();
  await page.reload();
  await expect.poll(browserHeight).toBe(height);
});
