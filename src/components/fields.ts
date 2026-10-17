// ChipInput settings for genres and playlists, shared by the add and edit forms.

import { playlists } from "../lib/browse.ts";
import type { Library } from "../lib/library.svelte.ts";
import { findGenreByName } from "../lib/model.ts";

/** Genres are stored as ids; typing an unknown name offers to create it. */
export function genreChips(library: Library) {
  return {
    suggestions: library.genres.map((g) => g.name),
    resolve: async (name: string) => (findGenreByName(library.genres, name) ?? (await library.addGenre(name))).id,
    labelFor: (id: string) => library.genres.find((g) => g.id === id)?.name ?? id,
    actionLabel: (name: string) => (findGenreByName(library.genres, name) ? "Add" : `Create “${name}”`),
    placeholder: "Add genre",
  };
}

/** Playlists are tags; a name matching an existing one (ignoring case) reuses it. */
export function playlistChips(library: Library) {
  const existing = playlists(library.albums);
  const match = (name: string) => existing.find((t) => t.toLowerCase() === name.toLowerCase());
  return {
    suggestions: existing,
    resolve: (name: string) => match(name) ?? name,
    actionLabel: (name: string) => (match(name) ? "Add" : `New playlist “${name}”`),
    placeholder: "Add to playlist",
  };
}

/** Artists are typed in one field, separated by ";" (names can contain commas). */
export const splitArtists = (text: string) => text.split(";");
export const joinArtists = (artists: string[]) => artists.join("; ");

export function parseYear(text: string): number | null {
  if (!text.trim()) return null;
  const year = Number(text);
  if (!Number.isInteger(year)) throw new Error("Year must be a number");
  return year;
}
