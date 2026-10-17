import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvAlbums } from "./csv.ts";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF and blank lines", () => {
    const text = 'a,b\r\n"x, y","say ""hi"""\r\n\r\nlast,\n';
    expect(parseCsv(text)).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["last", ""],
    ]);
  });

  it("keeps line breaks inside quoted fields", () => {
    expect(parseCsv('a\n"one\ntwo"')).toEqual([["a"], ["one\ntwo"]]);
  });
});

describe("parseCsvAlbums", () => {
  it("reads a Last.fm export", () => {
    const text = [
      "rank,artist,album,plays,lastfm_cover",
      "1,The Rural Alberta Advantage,Hometowns,2205,https://example.com/a.png",
      '2,"Godspeed You! Black Emperor","Lift Your Skinny Fists Like Antennas to Heaven",300,',
      "3,,No Artist,10,",
    ].join("\n");
    expect(parseCsvAlbums(text)).toEqual([
      { title: "Hometowns", artist: "The Rural Alberta Advantage", year: null, plays: 2205, spotify: null },
      {
        title: "Lift Your Skinny Fists Like Antennas to Heaven",
        artist: "Godspeed You! Black Emperor",
        year: null,
        plays: 300,
        spotify: null,
      },
    ]);
  });

  it("finds columns by other common names, in any order", () => {
    const text = "﻿Year,Title,Album Artist,Spotify\n1959,Kind of Blue,Miles Davis,spotify:album:1weenld61qoidwYuZ1GESA";
    expect(parseCsvAlbums(text)).toEqual([
      { title: "Kind of Blue", artist: "Miles Davis", year: 1959, plays: null, spotify: "spotify:album:1weenld61qoidwYuZ1GESA" },
    ]);
  });

  it("needs album and artist columns", () => {
    expect(() => parseCsvAlbums("foo,bar\n1,2")).toThrow(/album/);
    expect(() => parseCsvAlbums("")).toThrow(/empty/);
  });
});
