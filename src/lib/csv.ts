// Album lists from CSV files (e.g. a Last.fm export): one album per row,
// columns found by their header names.

/** Parses CSV text (comma separated, double-quoted fields, "" escapes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop blank lines.
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

export interface CsvAlbum {
  title: string;
  artist: string;
  year: number | null;
  plays: number | null;
  spotify: string | null;
}

// Accepted header names for each column, lowercase.
const COLUMNS = {
  title: ["album", "title", "album title", "album name", "name"],
  artist: ["artist", "album artist", "artist name", "artists"],
  year: ["year", "release year"],
  plays: ["plays", "playcount", "play count", "scrobbles", "count"],
  spotify: ["spotify", "spotify link", "spotify uri", "link", "url"],
};

/**
 * Reads albums from CSV text whose first row names the columns. Album and
 * artist columns are required; year, plays and a Spotify link are optional.
 * Rows missing an album or artist are skipped.
 */
export function parseCsvAlbums(text: string): CsvAlbum[] {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ""));
  if (!header) throw new Error("The file is empty");
  const names = header.map((h) => h.trim().toLowerCase());
  const column = (key: keyof typeof COLUMNS) => {
    for (const name of COLUMNS[key]) {
      const i = names.indexOf(name);
      if (i >= 0) return i;
    }
    return -1;
  };
  const title = column("title");
  const artist = column("artist");
  if (title < 0 || artist < 0) {
    throw new Error('Expected a header row with "album" and "artist" columns');
  }
  const year = column("year");
  const plays = column("plays");
  const spotify = column("spotify");
  const number = (value: string | undefined) => {
    const n = Number.parseInt(value ?? "", 10);
    return Number.isNaN(n) ? null : n;
  };

  return rows
    .map((r) => ({
      title: r[title]?.trim() ?? "",
      artist: r[artist]?.trim() ?? "",
      year: year < 0 ? null : number(r[year]),
      plays: plays < 0 ? null : number(r[plays]),
      spotify: spotify < 0 ? null : r[spotify]?.trim() || null,
    }))
    .filter((a) => a.title && a.artist);
}
