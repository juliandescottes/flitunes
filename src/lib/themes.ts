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

/** Applies a theme to the page, and to the window's title bar when installed as an app. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.style.setProperty("--hue", String(theme.hue));
  root.style.setProperty("--tint", String(theme.tint));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor(theme));
}

/**
 * The theme's toolbar color (the top of its gradient in app.css), as hex:
 * the theme-color meta tag, used for an installed app's title bar, needs a
 * plain color.
 */
export function themeColor(theme: Theme): string {
  return oklchToHex(0.937, 0.016 * theme.tint, theme.hue);
}

/** OKLCH (lightness 0-1, chroma, hue in degrees) to an sRGB hex color, clamped. */
export function oklchToHex(l: number, c: number, h: number): string {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return (
    "#" +
    linear
      .map((v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))
      .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** The favicon's tile color (public/favicon.svg), the pink theme's. */
const FAVICON_TILE = 'fill="#ec5c9c"';

/** The favicon in a theme's tint: same lightness, the theme's hue and chroma. */
export function themedFavicon(svg: string, theme: Theme): string {
  return svg.replace(FAVICON_TILE, `fill="oklch(67.8% ${(0.188 * theme.tint).toFixed(3)} ${theme.hue})"`);
}

let faviconHref: string | null = null;
let faviconSource: Promise<string> | null = null;
let faviconRequest = 0;

/** Tints the page's favicon: the original file for pink, else a data: URL of the tinted SVG. */
export async function applyFavicon(theme: Theme): Promise<void> {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  faviconHref ??= link.href;
  const request = ++faviconRequest;
  if (theme.id === THEMES[0].id) {
    link.href = faviconHref;
    return;
  }
  try {
    faviconSource ??= fetch(faviconHref).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))));
    const svg = await faviconSource;
    // A later theme change wins.
    if (request === faviconRequest) link.href = `data:image/svg+xml,${encodeURIComponent(themedFavicon(svg, theme))}`;
  } catch {
    // Keep the current icon; try fetching again next time.
    faviconSource = null;
  }
}
