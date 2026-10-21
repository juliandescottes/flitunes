import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { THEMES, themeById, themedFavicon } from "./themes.ts";

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

describe("themedFavicon", () => {
  it("tints the favicon's tile", () => {
    const svg = readFileSync("public/favicon.svg", "utf8");
    const blue = themedFavicon(svg, themeById("blue"));
    expect(blue).not.toContain("#ec5c9c");
    expect(blue).toContain('fill="oklch(67.8% 0.169 245)"');
  });
});
