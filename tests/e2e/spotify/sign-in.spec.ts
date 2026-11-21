import { expect, test, type Page } from "@playwright/test";
import { FakeSpotify, signInToSpotify } from "../spotify.ts";
import { album, albumMenu, openApp } from "../testutils.ts";

const LIBRARY = {
  albums: [album({ title: "Kind of Blue", artists: ["Miles Davis"], spotify: "spotify:playlist:37i9dQZF1DXbITWG1ZJKYt" })],
};

function spotifyButton(page: Page) {
  return page.getByRole("button", { name: "Connected to Spotify" });
}

/**
 * Clicks the Spotify button, and returns the address of Spotify's sign-in
 * page it led to (faked: the test plays Spotify's part).
 */
async function startSignIn(page: Page): Promise<URL> {
  let signInPage: URL | null = null;
  await page.route("https://accounts.spotify.com/authorize?**", async (route) => {
    signInPage = new URL(route.request().url());
    await route.fulfill({ contentType: "text/html", body: "<h1>Spotify sign-in</h1>" });
  });
  await spotifyButton(page).click();
  await expect(page.getByRole("heading", { name: "Spotify sign-in" })).toBeVisible();
  return signInPage!;
}

test("Signing in goes through Spotify's page and back", { tag: ["@spotify.sign-in"] }, async ({ page }) => {
  const spotify = new FakeSpotify();
  await spotify.install(page);
  let tokenRequest: URLSearchParams | null = null;
  await page.route("https://accounts.spotify.com/api/token", async (route) => {
    tokenRequest = new URLSearchParams(route.request().postData() ?? "");
    await route.fulfill({ json: { access_token: "fake-access", refresh_token: "fake-refresh", expires_in: 3600 } });
  });
  await openApp(page, LIBRARY);
  await expect(spotifyButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("group", { name: "Playback" })).toBeHidden();

  // Spotify's page, for playback permissions only.
  const signInPage = await startSignIn(page);
  const asked = signInPage.searchParams;
  expect(asked.get("client_id")).toBe("fake-client");
  expect(asked.get("redirect_uri")).toBe("http://127.0.0.1:5183/");
  expect(asked.get("scope")).toBe("user-read-playback-state user-modify-playback-state user-read-currently-playing");

  // Spotify sends the user back with a code.
  await page.goto(`/?code=fake-code&state=${asked.get("state")}`);
  await expect(spotifyButton(page)).toHaveAttribute("aria-pressed", "true");
  expect(tokenRequest!.get("code")).toBe("fake-code");
  await expect(spotifyButton(page)).toHaveAttribute("title", "Connected to Spotify as Test Listener. Click to disconnect.");
  await expect(page.getByRole("group", { name: "Playback" })).toBeVisible();
  // The address is clean again.
  await expect.poll(() => page.url()).toBe("http://127.0.0.1:5183/");

  // Still signed in after a reload.
  await page.reload();
  await expect(spotifyButton(page)).toHaveAttribute("aria-pressed", "true");
});

test("A sign-in cancelled on Spotify's page says so", { tag: ["@spotify.sign-in-errors"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  const signInPage = await startSignIn(page);

  await page.goto(`/?error=access_denied&state=${signInPage.searchParams.get("state")}`);
  await expect(page.getByText("Spotify sign-in was cancelled.")).toBeVisible();
  await expect(spotifyButton(page)).toHaveAttribute("aria-pressed", "false");
});

test("A return from Spotify that this browser didn't start is refused", { tag: ["@spotify.sign-in-errors"] }, async ({ page }) => {
  await openApp(page, LIBRARY, "/?code=someone-elses-code&state=unknown");

  await expect(page.getByText("This Spotify sign-in wasn't started here. Please try again.")).toBeVisible();
  await expect(spotifyButton(page)).toHaveAttribute("aria-pressed", "false");
});

test("The Spotify button signs out", { tag: ["@spotify.sign-out"] }, async ({ page }) => {
  await signInToSpotify(page, new FakeSpotify());
  await openApp(page, LIBRARY);
  await expect(spotifyButton(page)).toHaveAttribute("aria-pressed", "true");

  await spotifyButton(page).click();
  await expect(spotifyButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("group", { name: "Playback" })).toBeHidden();

  await page.reload();
  await expect(spotifyButton(page)).toHaveAttribute("aria-pressed", "false");
});

test("When Spotify refuses the session, FliTunes signs out", { tag: ["@spotify.sign-out"] }, async ({ page }) => {
  const spotify = new FakeSpotify();
  await signInToSpotify(page, spotify);
  await openApp(page, LIBRARY);

  spotify.revoked = true;
  await albumMenu(page, "Kind of Blue", "Play");
  await expect(page.getByText("Spotify signed you out. Please connect again.")).toBeVisible();
  await expect(spotifyButton(page)).toHaveAttribute("aria-pressed", "false");
});
