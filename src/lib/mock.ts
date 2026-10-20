// Mock libraries for performance tests: deterministic (seeded), shaped like
// a real one (a few prolific artists, many with one album, compilations,
// editions sharing a title, accents, missing links and covers).

import { VARIOUS_ARTISTS, slugify, type Album, type Genre, type LibraryFile } from "./model.ts";
import { SCHEMA_VERSION } from "./model.ts";

const WORDS = [
  "blue", "night", "river", "glass", "summer", "echo", "golden", "silent", "paper", "ghost",
  "electric", "velvet", "winter", "lights", "ocean", "dream", "fire", "city", "garden", "stone",
  "neon", "wild", "hollow", "crystal", "shadow", "radio", "honey", "black", "white", "sun",
  "moon", "rain", "heart", "machine", "forest", "secret", "desert", "atlas", "violet", "storm",
  "été", "café", "rêve", "lumière", "cœur", "forêt", "ciel", "étoile", "mémoire", "océan",
];
const GENRES = [
  "Rock", "Indie Rock", "Post-Rock", "Electronic", "Ambient", "Jazz", "Classical", "Hip-Hop",
  "Folk", "Indie Folk", "Metal", "Heavy Metal", "Pop", "Soul", "Funk", "Shoegaze", "Soundtrack",
  "Chanson", "Experimental", "Blues", "Reggae", "Punk", "Drone", "Trip-Hop", "J-Pop",
];
const TAGS = ["vinyl", "chill", "summer", "favorites", "road trip", "rainy day", "focus", "party"];
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Small seeded PRNG (mulberry32), so every run builds the same library. */
function random(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MockOptions {
  albums?: number;
  seed?: number;
  /** Cover URLs to reuse (e.g. from a real library); covers are null without them. */
  covers?: string[];
}

export function mockLibrary({ albums: count = 3000, seed = 1, covers = [] }: MockOptions = {}): LibraryFile {
  const rand = random(seed);
  const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)];
  const words = (n: number) => {
    const w = Array.from({ length: n }, () => pick(WORDS));
    return w.map((x) => x[0].toUpperCase() + x.slice(1)).join(" ");
  };

  const genres: Genre[] = GENRES.map((name) => ({ id: slugify(name), name }));
  // About one artist per 3.5 albums; the first ones get most albums.
  const artists = Array.from({ length: Math.ceil(count / 3.5) }, (_, i) => {
    const name = words(1 + Math.floor(rand() * 3));
    return i % 7 === 0 ? `The ${name}` : `${name} ${i}`;
  });

  const albums: Album[] = [];
  const start = Date.parse("2026-01-01T00:00:00Z");
  for (let i = 0; i < count; i++) {
    const various = rand() < 0.04;
    const artist = various ? VARIOUS_ARTISTS : artists[Math.floor(artists.length * rand() ** 2)];
    const featuring = !various && rand() < 0.08 ? [pick(artists)] : [];
    // Some editions share the title of an earlier album by the same artist.
    const edition = albums.length > 0 && rand() < 0.03 ? albums[albums.length - 1] : null;
    const title = edition && edition.artists[0] === artist ? edition.title : words(1 + Math.floor(rand() * 4));
    const genreCount = rand() < 0.15 ? 0 : 1 + Math.floor(rand() * 2);
    const albumGenres = [...new Set(Array.from({ length: genreCount }, () => pick(genres).id))];
    const tags = rand() < 0.3 ? [...new Set(Array.from({ length: 1 + Math.floor(rand() * 2) }, () => pick(TAGS)))] : [];
    albums.push({
      id: `01MOCK${String(i).padStart(20, "0")}`,
      title,
      artists: [artist, ...featuring],
      artistSort: null,
      year: rand() < 0.2 ? null : 1960 + Math.floor(rand() * 66),
      genres: albumGenres,
      tags: tags.sort(),
      rating: rand() < 0.6 ? null : 1 + Math.floor(rand() * 5),
      notes: rand() < 0.1 ? words(8) : "",
      spotify:
        rand() < 0.25 ? null : `spotify:album:${Array.from({ length: 22 }, () => pick([...BASE62])).join("")}`,
      cover: covers.length > 0 && rand() < 0.8 ? pick(covers) : null,
      addedAt: new Date(start + Math.floor(rand() * 300) * 86400000).toISOString(),
    });
  }
  return { schemaVersion: SCHEMA_VERSION, exportedAt: "2026-10-21T00:00:00.000Z", genres, albums };
}
