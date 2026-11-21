// Helpers for the e2e tests: building a library, opening the app on it, and
// acting and reading through the UI the way a user would.
//
// Each test serves its own library: /__library (the dev server's library
// endpoint) is intercepted, so nothing is read from or written to disk, and
// each test runs in a fresh browser context, so IndexedDB starts empty.

import { expect, type Locator, type Page } from "@playwright/test";
import type { Album, Genre, LibraryFile } from "../../src/lib/model.ts";
import { slugify } from "../../src/lib/model.ts";

// --- Building a library ---

let nextId = 1;

/** An album with every field filled: the given ones, else empty values. */
export function album(fields: Partial<Album> & { title: string; artists: string[] }): Album {
  return {
    id: `ALBUM${String(nextId++).padStart(4, "0")}`,
    artistSort: null,
    year: null,
    genres: [],
    tags: [],
    rating: null,
    notes: "",
    spotify: null,
    cover: null,
    addedAt: daysAgo(100),
    ...fields,
  };
}

/** A genre whose id is its slug, as the app makes them. */
export function genre(name: string): Genre {
  return { id: slugify(name), name };
}

/** An ISO date `days` days before now. */
export function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// --- Opening the app ---

type LibraryContent = { genres?: Genre[]; albums: Album[] };

/** A library file, as the dev server serves it. */
export function libraryFile(library: LibraryContent, exportedAt = "2026-01-01T00:00:00.000Z"): LibraryFile {
  return { schemaVersion: 1, exportedAt, genres: library.genres ?? [], albums: library.albums };
}

/**
 * Opens the app on a library, served as library.json, at an address ("/"
 * by default). Returns:
 * - `saved`: the files the app saved (POSTs to the endpoint), newest last;
 * - `keptCovers`: the covers the app asked to copy into covers/;
 * - `serve(file)`: serves another library.json from now on (for reloads).
 *
 * Requests to other sites fail, unless the test fakes them with page.route
 * (fakeOembed, signInToSpotify): nothing leaves the machine.
 */
export async function openApp(page: Page, library: LibraryContent | LibraryFile, address = "/") {
  let file: LibraryFile = "schemaVersion" in library ? library : libraryFile(library);
  const saved: LibraryFile[] = [];
  const keptCovers: { albumId: string; url: string }[] = [];
  // Page routes win over context routes: this one catches what tests don't fake.
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1:5183\/)/, (route) => route.abort());
  await page.route("**/__library", async (route) => {
    if (route.request().method() === "POST") {
      saved.push(JSON.parse(route.request().postData() ?? "null"));
      await route.fulfill({ status: 204 });
    } else {
      await route.fulfill({ json: file });
    }
  });
  await page.route("**/__library/covers", async (route) => {
    const request = route.request().postDataJSON() as { albumId: string; url: string };
    keptCovers.push(request);
    await route.fulfill({ json: { cover: `covers/${request.albumId}.jpg` } });
  });
  await page.route("**/__library/covers/*", (route) => route.fulfill({ status: 404 }));
  await page.goto(address);
  await expect(page.getByText("Loading…")).toBeHidden();
  return {
    saved,
    keptCovers,
    serve(next: LibraryFile) {
      file = next;
    },
  };
}

/**
 * Fakes Spotify's oEmbed lookups (title and cover of a link), by Spotify
 * id. Unknown ids answer 404. Returns the ids looked up.
 */
export async function fakeOembed(page: Page, albums: Record<string, { title: string; cover?: string }>) {
  const lookedUp: string[] = [];
  await page.route("https://open.spotify.com/oembed?**", async (route) => {
    const link = new URL(route.request().url()).searchParams.get("url") ?? "";
    const id = link.split("/").pop()!;
    lookedUp.push(id);
    const info = albums[id];
    if (!info) return route.fulfill({ status: 404, json: {} });
    await route.fulfill({ json: { title: info.title, thumbnail_url: info.cover } });
  });
  return lookedUp;
}

// --- Sources, search and filters ---

/** Clicks a source by its name (without the count after it, "Triage" for "Triage 2"). */
export async function selectSource(page: Page, name: string) {
  const sourceName = new RegExp(`^${escapeRegExp(name)}( \\d+)?$`);
  await page.getByRole("navigation", { name: "Sources" }).getByRole("button", { name: sourceName }).click();
}

/** The sources listed, in order, a count after the name when there is one ("Triage 2"). */
export async function assertSources(page: Page, names: string[]) {
  const buttons = page.getByRole("navigation", { name: "Sources" }).getByRole("button");
  await expect.poll(() => buttons.evaluateAll((all) => all.map((b) => b.textContent!.replace(/\s+/g, " ").trim()))).toEqual(names);
}

export function searchField(page: Page): Locator {
  return page.getByRole("searchbox");
}

export async function searchFor(page: Page, text: string) {
  await searchField(page).fill(text);
}

export async function toggleLinkFilter(page: Page) {
  await page.getByRole("button", { name: "Only albums with a Spotify link" }).click();
}

// --- Column browser ---

type ColumnName = "Genres" | "Artists" | "Albums";

export function column(page: Page, name: ColumnName): Locator {
  return page.getByRole("listbox", { name, exact: true });
}

/** Clicks an entry of a column ("All (…)" for All). */
export async function pickInColumn(page: Page, name: ColumnName, entry: string) {
  await column(page, name).getByRole("option", { name: entry, exact: true }).click();
}

/** The entries of a column, "All (…)" first. */
export async function assertColumn(page: Page, name: ColumnName, entries: string[]) {
  await expect(column(page, name).getByRole("option")).toHaveText(entries);
}

export async function assertColumnPick(page: Page, name: ColumnName, entry: string) {
  await expect(column(page, name).getByRole("option", { selected: true })).toHaveText(entry);
}

// --- Main view ---

/** Album rows of the list (List or Album List view). */
function albumRows(page: Page): Locator {
  return page.locator("tr[data-id]");
}

/** The title in a row's Name cell, without the cover placeholder or the play button. */
function rowTitles(rows: Locator): Promise<string[]> {
  return rows.evaluateAll((trs) =>
    trs.map((tr) =>
      [...tr.querySelector("td.name")!.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join("")
        .trim(),
    ),
  );
}

/** The titles of the albums in the list, in order. */
export async function assertShownAlbums(page: Page, titles: string[]) {
  await expect.poll(() => rowTitles(albumRows(page))).toEqual(titles);
}

/** The titles of the selected albums in the list, in order. */
export async function assertSelectedAlbums(page: Page, titles: string[]) {
  await expect.poll(() => rowTitles(albumRows(page).and(page.locator("[aria-selected=true]")))).toEqual(titles);
}

/** The title and artist of each album in the grid, as "Title / Artist". */
export async function assertGridAlbums(page: Page, albums: string[]) {
  await expect(gridAlbums(page)).toHaveText(
    albums.map((a) => {
      const [title, artist] = a.split(" / ");
      return new RegExp(`^\\s*(♫)?\\s*${escapeRegExp(title)}\\s*${escapeRegExp(artist)}\\s*$`);
    }),
  );
}

/** The albums of the grid (the column browser's Albums column is a listbox too). */
function gridAlbums(page: Page): Locator {
  return page.getByRole("region", { name: "Albums" }).getByRole("option");
}

function gridAlbum(page: Page, title: string): Locator {
  return gridAlbums(page).filter({ hasText: title });
}

export async function clickGridAlbum(page: Page, title: string) {
  await gridAlbum(page, title).click();
}

/** The one album selected in the grid. */
export async function assertGridSelection(page: Page, title: string) {
  const selected = gridAlbums(page).and(page.locator("[aria-selected=true]"));
  await expect(selected).toHaveCount(1);
  await expect(selected).toContainText(title);
}

/** An album's row in the list. */
export function albumRow(page: Page, title: string): Locator {
  return albumRows(page).filter({
    has: page.locator("td.name", { hasText: new RegExp(`^\\s*(♫)?\\s*${escapeRegExp(title)}\\s*$`) }),
  });
}

/**
 * Clicks an album in the list (on its Artist cell, away from the stars and
 * the play button). `modifiers` as in Playwright, e.g. ["ControlOrMeta"].
 */
export async function clickAlbum(page: Page, title: string, modifiers: ("ControlOrMeta" | "Shift")[] = []) {
  await albumRow(page, title).locator("td.artist").click({ modifiers });
}

/** One cell of an album's row: "Artist", "Year", "Genre", "Rating"... */
export function albumCell(page: Page, title: string, column: "Artist" | "Year" | "Genre" | "Rating"): Locator {
  const cell = { Artist: "td.artist", Year: "td.year", Genre: "td.genre", Rating: "td.rating" }[column];
  return albumRow(page, title).locator(cell);
}

/** The rating shown in an album's row, as a number of stars (0 when unrated). */
export async function assertRating(page: Page, title: string, stars: number) {
  await expect(albumCell(page, title, "Rating").getByText("★")).toHaveCount(stars);
}

/** Clicks a star in an album's Rating cell, hovering it first as the empty stars only show then. */
export async function rateInList(page: Page, title: string, stars: number) {
  const cell = albumCell(page, title, "Rating");
  await cell.getByRole("radiogroup").hover();
  await cell.getByRole("radio", { name: stars === 1 ? "1 star" : `${stars} stars` }).click();
}

export async function switchView(page: Page, view: "List" | "Album List" | "Grid") {
  await page.getByRole("group", { name: "View" }).getByRole("button", { name: view, exact: true }).click();
}

export async function sortBy(page: Page, header: "Name" | "Artist" | "Year" | "Genre" | "Rating" | "Date Added") {
  await sortHeader(page, header).getByRole("button").click();
}

export async function assertSortedBy(page: Page, header: string, direction: "ascending" | "descending") {
  await expect(sortHeader(page, header)).toHaveAttribute("aria-sort", direction);
}

function sortHeader(page: Page, header: string): Locator {
  return page.getByRole("columnheader", { name: new RegExp(`^${escapeRegExp(header)}\\b`) });
}

/** Focuses the main view (the list or grid) without changing the selection. */
export async function focusMainView(page: Page) {
  await page.getByRole("region", { name: "Albums" }).locator("[tabindex='0']").focus();
}

/** The album count in the status bar, e.g. "3 albums · 2 selected". */
export async function assertStatus(page: Page, text: string) {
  await expect(page.getByRole("contentinfo").locator(".count")).toHaveText(text);
}

/** The display at the top of the window: its two lines. */
export async function assertDisplay(page: Page, title: string, subtitle: string) {
  const display = page.locator(".lcd");
  await expect(display.locator(".lcd-title")).toHaveText(title);
  await expect(display.locator(".lcd-sub")).toHaveText(subtitle);
}

// --- Menus, dialogs, Get Info ---

/** Right-clicks an album and picks an item of its context menu. */
export async function albumMenu(page: Page, title: string, item: string) {
  await albumRow(page, title).locator("td.artist").click({ button: "right" });
  await page.getByRole("menu").getByRole("menuitem", { name: item, exact: true }).click();
}

/**
 * Answers the next confirm() with OK (or Cancel when `accept` is false).
 * Returns its message once it has been shown.
 */
export function answerConfirm(page: Page, accept = true): Promise<string> {
  return page.waitForEvent("dialog").then(async (dialog) => {
    const message = dialog.message();
    await (accept ? dialog.accept() : dialog.dismiss());
    return message;
  });
}

/** The Get Info window. */
export function infoWindow(page: Page): Locator {
  return page.locator("dialog.info-window");
}

export async function openGetInfo(page: Page): Promise<Locator> {
  await page.keyboard.press("ControlOrMeta+i");
  await expect(infoWindow(page)).toBeVisible();
  return infoWindow(page);
}

/** A labelled field of the Get Info window. */
export function infoField(info: Locator, label: string): Locator {
  return info.getByLabel(label, { exact: true });
}

/** The chip field after a label ("Genres", "Playlists", "Add to"...) of the Get Info window. */
export function chipField(info: Locator, label: string): Locator {
  return info.locator(".label", { hasText: new RegExp(`^${escapeRegExp(label)}$`) }).locator("xpath=following-sibling::div[1]");
}

/** The chips of a chip field, in order. */
export async function assertChips(field: Locator, names: string[]) {
  await expect(field.locator(".chip .label")).toHaveText(names);
}

/** Types a name in a chip field and presses Enter. */
export async function addChip(field: Locator, name: string) {
  await chipInput(field).fill(name);
  await chipInput(field).press("Enter");
}

/** The text field after a chip field's chips. */
export function chipInput(field: Locator): Locator {
  return field.locator("input");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Sheets (Add to Library, the GitHub token) ---

/** The sheet sliding down from the toolbar, while one is open. */
export function sheet(page: Page): Locator {
  return page.locator("dialog.sheet[open]");
}

export async function openAddSheet(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "+ Add Album(s)" }).click();
  await expect(sheet(page).getByRole("heading", { name: "Add to Library" })).toBeVisible();
  return sheet(page);
}

/** The chips of the chip field whose text field has this placeholder ("Add genre", "Add to playlist"). */
export function chipsWithPlaceholder(scope: Locator, placeholder: "Add genre" | "Add to playlist"): Locator {
  return scope.locator(".chips", { has: scope.page().getByPlaceholder(placeholder) });
}

/** Pastes text into a field, through the clipboard, as ⌘V would. */
export async function pasteInto(field: Locator, text: string) {
  await field.focus();
  await field.page().evaluate((t) => navigator.clipboard.writeText(t), text);
  await field.page().keyboard.press("ControlOrMeta+v");
}

/** A file to give to a file field, from its text. */
export function textFile(name: string, text: string) {
  return { name, mimeType: name.endsWith(".csv") ? "text/csv" : "application/json", buffer: Buffer.from(text) };
}

/** The number of unsaved changes, as the window title shows it. */
export async function assertUnsavedChanges(page: Page, count: number) {
  await expect(page).toHaveTitle(count === 0 ? "FliTunes" : `FliTunes (${count} unsaved)`);
}

/** The selected source in the source list. */
export async function assertSelectedSource(page: Page, name: string) {
  const selected = page.getByRole("navigation", { name: "Sources" }).locator("button[aria-current=true]");
  await expect(selected).toHaveText(new RegExp(`^\\s*${escapeRegExp(name)}(\\s+\\d+)?\\s*$`));
}

/** The values of several text fields, in order. */
export async function assertValues(fields: Locator, values: string[]) {
  await expect.poll(() => fields.evaluateAll((all) => all.map((f) => (f as HTMLInputElement).value))).toEqual(values);
}

// --- Spotify: the display while playing, an album's tracks ---

/** The times under the playing track in the display: elapsed, then left ("-9:22"). */
export async function assertDisplayTimes(page: Page, elapsed: string, left: string) {
  await expect(page.locator(".lcd-progress > span:not(.bar)")).toHaveText([elapsed, left]);
}

/** The tracks shown for an album. */
export function trackList(page: Page, albumTitle: string): Locator {
  return page.getByRole("grid", { name: `Tracks of ${albumTitle}` });
}

/**
 * The rows of an album's track list, each as its cells' text: "#", Name,
 * Time, Artist, Album, Genre, Year. A disc's row is its one cell ("Disc 2").
 */
export async function assertTracks(page: Page, albumTitle: string, rows: string[][]) {
  const read = () =>
    trackList(page, albumTitle)
      .locator("tbody tr")
      .evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent!.trim()).filter((t, i) => i > 0 || t !== "")));
  await expect.poll(read).toEqual(rows);
}

/** A track's row in an album's track list. */
export function trackRow(page: Page, albumTitle: string, name: string): Locator {
  return trackList(page, albumTitle).locator("tbody tr", { has: page.locator("td.name", { hasText: new RegExp(`^${escapeRegExp(name)}$`) }) });
}

/** The play button of an album's row, which shows while the row is hovered. */
export async function rowPlayButton(page: Page, title: string): Promise<Locator> {
  await albumRow(page, title).hover();
  return albumRow(page, title).locator("td.name").getByRole("button");
}
