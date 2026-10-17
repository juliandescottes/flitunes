import { describe, expect, it } from "vitest";
import { fetchSpotifyAlbumInfo, largeSpotifyCover, parseSpotifyAlbumId } from "./spotify.ts";

const ID = "1weenld61qoidwYuZ1GESA";

/** A fetch stub that records the requested URLs and answers with `body`. */
function stubFetch(body: unknown, status = 200) {
  const urls: string[] = [];
  const fetchFn = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fetchFn, urls };
}

describe("parseSpotifyAlbumId", () => {
  it.each([
    `https://open.spotify.com/album/${ID}`,
    `https://open.spotify.com/album/${ID}?si=abc123`,
    `https://open.spotify.com/intl-fr/album/${ID}?si=abc`,
    `https://open.spotify.com/embed/album/${ID}?utm_source=oembed`,
    `open.spotify.com/album/${ID}`,
    `  spotify:album:${ID}  `,
  ])("parses %s", (input) => {
    expect(parseSpotifyAlbumId(input)).toBe(ID);
  });

  it.each([
    "",
    "Kind of Blue",
    `https://open.spotify.com/track/${ID}`,
    `https://example.com/album/${ID}`,
    "https://open.spotify.com/album/tooshort",
    "spotify:album:tooshort",
  ])("rejects %j", (input) => {
    expect(parseSpotifyAlbumId(input)).toBeNull();
  });
});

describe("Spotify oEmbed", () => {
  it("upgrades covers to 640px", () => {
    expect(largeSpotifyCover("https://i.scdn.co/image/ab67616d00001e02abc")).toBe(
      "https://i.scdn.co/image/ab67616d0000b273abc",
    );
  });

  it("returns the title and the large cover", async () => {
    const { fetchFn, urls } = stubFetch({
      title: "Kind Of Blue",
      thumbnail_url: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02387a",
    });
    expect(await fetchSpotifyAlbumInfo(ID, fetchFn)).toEqual({
      title: "Kind Of Blue",
      cover: "https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b273387a",
    });
    expect(urls[0]).toBe(`https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Falbum%2F${ID}`);
  });

  it("fails on HTTP errors", async () => {
    const { fetchFn } = stubFetch({}, 404);
    await expect(fetchSpotifyAlbumInfo(ID, fetchFn)).rejects.toThrow("HTTP 404");
  });
});
