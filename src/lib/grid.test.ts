import { describe, expect, it } from "vitest";
import { gridColumns, gridCoverSize } from "./grid.ts";

describe("gridColumns", () => {
  it("fits as many 150px columns as auto-fill does", () => {
    expect(gridColumns(0)).toBe(1);
    expect(gridColumns(181)).toBe(1);
    expect(gridColumns(182 + 150)).toBe(1);
    expect(gridColumns(32 + 150 * 2 + 12)).toBe(2);
    expect(gridColumns(1090)).toBe(6);
  });
});

describe("gridCoverSize", () => {
  it("is the column width minus the item padding", () => {
    expect(gridCoverSize(32 + 150 * 2 + 12)).toBe(138);
    expect(gridCoverSize(1090)).toBeCloseTo(154.33, 2);
  });
});
