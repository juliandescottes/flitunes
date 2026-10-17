import { describe, expect, it } from "vitest";
import { findGenreByName } from "./model.ts";

describe("findGenreByName", () => {
  const genres = [{ id: "hip-hop-rap", name: "Hip-Hop/Rap" }, { id: "rnb", name: "R&B" }];

  it("matches ignoring case and punctuation", () => {
    expect(findGenreByName(genres, "hip hop / rap")?.id).toBe("hip-hop-rap");
    expect(findGenreByName(genres, "Jazz")).toBeUndefined();
    expect(findGenreByName(genres, "")).toBeUndefined();
  });
});
