import { describe, expect, it } from "vitest";
import { THEMES, themeById } from "./themes.ts";

describe("themeById", () => {
  it("finds a theme, and falls back to pink", () => {
    expect(themeById("mint").name).toBe("Mint Green");
    expect(themeById("unknown")).toBe(THEMES[0]);
    expect(themeById(undefined).id).toBe("pink");
  });

  it("has unique ids", () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
  });
});
