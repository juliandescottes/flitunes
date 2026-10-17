import { describe, expect, it } from "vitest";
import { fetchSpotifyInfo, largeSpotifyCover, parseSpotifyLink, parseSpotifyLinks, spotifyWebUrl } from "./spotify.ts";

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

describe("parseSpotifyLink", () => {
  it.each([
    `https://open.spotify.com/album/${ID}`,
    `https://open.spotify.com/album/${ID}?si=abc123`,
    `https://open.spotify.com/intl-fr/album/${ID}?si=abc`,
    `https://open.spotify.com/embed/album/${ID}?utm_source=oembed`,
    `open.spotify.com/album/${ID}`,
    `  spotify:album:${ID}  `,
  ])("parses the album link %s", (input) => {
    expect(parseSpotifyLink(input)).toBe(`spotify:album:${ID}`);
  });

  it.each([
    `https://open.spotify.com/playlist/${ID}?si=abc123`,
    `https://open.spotify.com/intl-fr/playlist/${ID}`,
    `spotify:playlist:${ID}`,
  ])("parses the playlist link %s", (input) => {
    expect(parseSpotifyLink(input)).toBe(`spotify:playlist:${ID}`);
  });

  it.each([
    "",
    "Kind of Blue",
    `https://open.spotify.com/track/${ID}`,
    `spotify:track:${ID}`,
    `https://example.com/album/${ID}`,
    "https://open.spotify.com/album/tooshort",
    "spotify:album:tooshort",
  ])("rejects %j", (input) => {
    expect(parseSpotifyLink(input)).toBeNull();
  });
});

describe("parseSpotifyLinks", () => {
  it("finds every album or playlist link, once, and reports the rest", () => {
    const other = "4LH4d3cOWNNsVw41Gqt2kv";
    const text = `https://open.spotify.com/album/${ID}?si=x\n\nspotify:playlist:${other}, open.spotify.com/album/${ID}\nhello`;
    expect(parseSpotifyLinks(text)).toEqual({
      uris: [`spotify:album:${ID}`, `spotify:playlist:${other}`],
      invalid: ["hello"],
    });
  });
});

describe("spotifyWebUrl", () => {
  it("turns a URI into a web link", () => {
    expect(spotifyWebUrl(`spotify:playlist:${ID}`)).toBe(`https://open.spotify.com/playlist/${ID}`);
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
    expect(await fetchSpotifyInfo(`spotify:album:${ID}`, fetchFn)).toEqual({
      title: "Kind Of Blue",
      cover: "https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b273387a",
    });
    expect(urls[0]).toBe(`https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Falbum%2F${ID}`);
  });

  it("fails on HTTP errors", async () => {
    const { fetchFn } = stubFetch({}, 404);
    await expect(fetchSpotifyInfo(`spotify:album:${ID}`, fetchFn)).rejects.toThrow("HTTP 404");
  });
});
