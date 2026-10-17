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
});
