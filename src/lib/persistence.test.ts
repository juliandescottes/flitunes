import { describe, expect, it } from "vitest";
import { coverSrc } from "./persistence.ts";

describe("coverSrc", () => {
  const base = "https://raw.githubusercontent.com/someone/flitunes-library/main/";

  it("resolves covers/ files next to library.json", () => {
    expect(coverSrc("covers/A1.jpg", base)).toBe(`${base}covers/A1.jpg`);
    expect(coverSrc("covers/A1.jpg", "http://127.0.0.1:5173/__library/")).toBe("http://127.0.0.1:5173/__library/covers/A1.jpg");
  });

  it("keeps URLs, and has nothing for no cover", () => {
    expect(coverSrc("https://i.scdn.co/image/ab67", base)).toBe("https://i.scdn.co/image/ab67");
    expect(coverSrc(null, base)).toBeNull();
  });
});
