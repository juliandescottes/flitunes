import { describe, expect, it } from "vitest";
import { albumMatchKey, findGenreByName } from "./model.ts";

describe("findGenreByName", () => {
  const genres = [{ id: "hip-hop-rap", name: "Hip-Hop/Rap" }, { id: "rnb", name: "R&B" }];

  it("matches ignoring case and punctuation", () => {
    expect(findGenreByName(genres, "hip hop / rap")?.id).toBe("hip-hop-rap");
    expect(findGenreByName(genres, "Jazz")).toBeUndefined();
    expect(findGenreByName(genres, "")).toBeUndefined();
  });
});

describe("albumMatchKey", () => {
  it("ignores case, accents, punctuation and a leading The", () => {
    expect(albumMatchKey("The Mountain Goats", "The Sunset Tree")).toBe(albumMatchKey("mountain goats", "the sunset tree"));
    expect(albumMatchKey("Múm", "Finally We Are No One")).toBe(albumMatchKey("mum", "Finally, We Are No One"));
    expect(albumMatchKey("Islands", "Arm’s Way")).toBe(albumMatchKey("Islands", "Arm's Way"));
  });

  it("keeps letters of every script", () => {
    expect(albumMatchKey("Kaneko Ayano", "燦々")).not.toBe(albumMatchKey("Kaneko Ayano", "祝祭"));
    expect(albumMatchKey("カネコアヤノ", "燦々")).not.toBe(albumMatchKey("加藤久貴", "燦々"));
    expect(albumMatchKey("Кино", "Группа крови")).not.toBe(albumMatchKey("Кино", "Звезда по имени Солнце"));
    expect(albumMatchKey("カネコアヤノ", "燦々 ひとりでに")).toBe(albumMatchKey("カネコアヤノ", "燦々・ひとりでに"));
    // Full-width Latin letters read as plain ones.
    expect(albumMatchKey("Ichiko Aoba", "ｑｐ")).toBe(albumMatchKey("Ichiko Aoba", "qp"));
  });

  it("compares a title without letters or digits as is", () => {
    expect(albumMatchKey("Sigur Rós", "( )")).toBe(albumMatchKey("Sigur Ros", "( )"));
    expect(albumMatchKey("Sigur Rós", "( )")).not.toBe(albumMatchKey("Sigur Rós", "…"));
  });
});
