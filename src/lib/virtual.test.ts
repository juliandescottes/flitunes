import { describe, expect, it } from "vitest";
import { revealRow, visibleRows } from "./virtual.ts";

describe("visibleRows", () => {
  it("covers the viewport plus the overscan", () => {
    expect(visibleRows(0, 100, 20, 1000, 2)).toEqual({ start: 0, end: 7 });
    expect(visibleRows(210, 100, 20, 1000, 2)).toEqual({ start: 8, end: 18 });
  });

  it("stays within the list", () => {
    expect(visibleRows(19_600, 500, 20, 1000, 2)).toEqual({ start: 978, end: 1000 });
    expect(visibleRows(50_000, 500, 20, 1000, 2)).toEqual({ start: 1000, end: 1000 });
    expect(visibleRows(-30, 100, 20, 3, 2)).toEqual({ start: 0, end: 3 });
    expect(visibleRows(0, 100, 20, 0)).toEqual({ start: 0, end: 0 });
  });
});

describe("revealRow", () => {
  it("leaves a visible row alone", () => {
    expect(revealRow(100, 20, 50, 200)).toBeNull();
  });

  it("scrolls up or down by as little as possible", () => {
    expect(revealRow(100, 20, 150, 200)).toBe(100);
    expect(revealRow(400, 20, 150, 200)).toBe(220);
  });

  it("keeps the row clear of a sticky header", () => {
    expect(revealRow(100, 20, 90, 200, 18)).toBe(82);
    expect(revealRow(10, 20, 5, 200, 18)).toBe(0);
  });
});
