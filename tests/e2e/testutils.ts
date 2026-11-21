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

/**
 * Opens the app on a library, served as library.json. Returns the files the
 * app saved (POSTs to the endpoint), newest last.
 */
export async function openApp(page: Page, library: { genres?: Genre[]; albums: Album[] }) {
  const file: LibraryFile = {
    schemaVersion: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    genres: library.genres ?? [],
    albums: library.albums,
  };
  const saved: LibraryFile[] = [];
  await page.route("**/__library", async (route) => {
    if (route.request().method() === "POST") {
      saved.push(JSON.parse(route.request().postData() ?? "null"));
      await route.fulfill({ status: 204 });
    } else {
      await route.fulfill({ json: file });
    }
  });
  await page.goto("/");
  await expect(page.getByText("Loading…")).toBeHidden();
  return { saved };
}

// --- Sources, search and filters ---

export async function selectSource(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Sources" }).getByRole("button", { name, exact: true }).click();
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
