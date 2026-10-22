import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { oklchToHex, themeColor, THEMES, themeById, themedFavicon } from "./themes.ts";

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

/** Hex colors equal within one step per channel (the OKLCH values are rounded). */
function close(a: string, b: string): boolean {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return rgb(a).every((v, i) => Math.abs(v - rgb(b)[i]) <= 1);
}

describe("themeColor", () => {
  it("converts OKLCH to hex", () => {
    expect(oklchToHex(1, 0, 0)).toBe("#ffffff");
    expect(oklchToHex(0, 0, 0)).toBe("#000000");
    // The pink selection color of app.css.
    expect(close(oklchToHex(0.615, 0.19, 0), "#d9457f")).toBe(true);
  });

  it("is the toolbar color of each theme", () => {
    // The pink theme's toolbar, as in index.html.
    expect(close(themeColor(themeById("pink")), "#f3e6ec")).toBe(true);
    const colors = THEMES.map(themeColor);
    expect(new Set(colors).size).toBe(THEMES.length);
    expect(colors.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
  });
});
