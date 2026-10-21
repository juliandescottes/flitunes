// Color themes: the iTunes 10 look in another tint. Every tinted color in the
// CSS is an OKLCH color whose hue is --hue and whose chroma is scaled by
// --tint, so a theme is just those two numbers.

export interface Theme {
  id: string;
  name: string;
  /** OKLCH hue, in degrees. */
  hue: number;
  /** Chroma scale: 1 is the pink theme's, 0 is grey. */
  tint: number;
}

export const THEMES: Theme[] = [
  { id: "pink", name: "Pink", hue: 352, tint: 1 },
  { id: "silver", name: "Silver", hue: 250, tint: 0.15 },
  { id: "mint", name: "Mint Green", hue: 170, tint: 0.6 },
  { id: "blue", name: "Fresh Blue", hue: 245, tint: 0.9 },
  { id: "lavender", name: "Lavender", hue: 300, tint: 0.6 },
];

/** The theme with this id, or the default (pink). */
export function themeById(id: unknown): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Applies a theme to the page. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.style.setProperty("--hue", String(theme.hue));
  root.style.setProperty("--tint", String(theme.tint));
}
