import { expect, test, type Page } from "@playwright/test";
import { album, openApp } from "../testutils.ts";

const LIBRARY = { albums: [album({ title: "Moon Safari", artists: ["Air"] })] };

function themeButton(page: Page) {
  return page.getByRole("button", { name: "Theme" });
}

async function pickTheme(page: Page, name: string) {
  await themeButton(page).click();
  await page.getByRole("menu").getByRole("menuitemradio", { name }).click();
}

/** The themes of the menu, and the checked one. */
async function assertThemeMenu(page: Page, checked: string) {
  await themeButton(page).click();
  const items = page.getByRole("menu").getByRole("menuitemradio");
  await expect(items).toHaveText(["Pink", "Silver", "Mint Green", "Fresh Blue", "Lavender"]);
  await expect(page.getByRole("menu").getByRole("menuitemradio", { checked: true })).toHaveText(checked);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
}

/** The toolbar's background, as the browser computes it. */
function toolbarBackground(page: Page): Promise<string> {
  return page.getByRole("banner").evaluate((toolbar) => getComputedStyle(toolbar).backgroundImage);
}

/** The color an installed app gives its title bar, as red, green and blue from 0 to 255. */
async function titleBarColor(page: Page): Promise<number[]> {
  const hex = (await page.locator('meta[name="theme-color"]').getAttribute("content"))!;
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

test("The theme menu tints the window, Pink by default", { tag: ["@themes.menu"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await assertThemeMenu(page, "Pink");
  await expect(themeButton(page)).toHaveAttribute("title", "Theme: Pink");
  const pink = await toolbarBackground(page);

  await pickTheme(page, "Fresh Blue");
  await assertThemeMenu(page, "Fresh Blue");
  await expect(themeButton(page)).toHaveAttribute("title", "Theme: Fresh Blue");
  await expect.poll(() => toolbarBackground(page)).not.toBe(pink);

  // Back to Pink: the same toolbar as at first.
  await pickTheme(page, "Pink");
  await expect.poll(() => toolbarBackground(page)).toBe(pink);
});

test("The theme is remembered", { tag: ["@themes.remembered"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await pickTheme(page, "Lavender");

  await page.reload();
  await assertThemeMenu(page, "Lavender");
  await expect(themeButton(page)).toHaveAttribute("title", "Theme: Lavender");
});

test("The app's title bar and the page icon follow the theme", { tag: ["@themes.window"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  const icon = page.locator('link[rel="icon"]');

  // Pink: a pinkish title bar (more red than green), the icon file as is.
  const [red, green] = await titleBarColor(page);
  expect(red).toBeGreaterThan(green + 8);
  await expect(icon).toHaveAttribute("href", /\/favicon\.svg$/);

  // Silver is nearly grey.
  await pickTheme(page, "Silver");
  await expect.poll(async () => {
    const [r, g, b] = await titleBarColor(page);
    return Math.max(r, g, b) - Math.min(r, g, b);
  }).toBeLessThan(6);
  // The icon is redrawn in the theme's tint.
  await expect(icon).toHaveAttribute("href", /^data:image\/svg\+xml,/);

  // Fresh Blue: more blue than red.
  await pickTheme(page, "Fresh Blue");
  await expect.poll(async () => {
    const [r, , b] = await titleBarColor(page);
    return b - r;
  }).toBeGreaterThan(8);

  await pickTheme(page, "Pink");
  await expect(icon).toHaveAttribute("href", /\/favicon\.svg$/);
});
