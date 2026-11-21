import { expect, test } from "@playwright/test";
import { album, clickAlbum, fakeOembed, infoField, openApp, openGetInfo } from "../testutils.ts";

const KIND_OF_BLUE = "1weenld61qoidwYuZ1GESA";

const LIBRARY = {
  albums: [
    album({
      title: "Kind of Blue",
      artists: ["Miles Davis"],
      spotify: `spotify:album:${KIND_OF_BLUE}`,
      cover: "https://covers.example.com/kind-of-blue-small.jpg",
    }),
    album({ title: "Bootleg", artists: ["Miles Davis"] }),
  ],
};

test("The Artwork tab edits, removes or fetches the cover", { tag: ["@album-editing.artwork"] }, async ({ page }) => {
  const lookedUp = await fakeOembed(page, {
    [KIND_OF_BLUE]: { title: "Kind of Blue", cover: "https://i.scdn.co/image/ab67616d00001e02kindofblue" },
  });
  const { keptCovers } = await openApp(page, LIBRARY);
  await clickAlbum(page, "Kind of Blue");
  let info = await openGetInfo(page);
  await info.getByRole("tab", { name: "Artwork" }).click();

  // The cover and its address.
  await expect(infoField(info, "Cover URL")).toHaveValue("https://covers.example.com/kind-of-blue-small.jpg");
  await expect(info.getByRole("img", { name: "Cover" })).toHaveAttribute("src", "https://covers.example.com/kind-of-blue-small.jpg");

  // Removed: no cover to show, nothing more to remove.
  await info.getByRole("button", { name: "Remove" }).click();
  await expect(infoField(info, "Cover URL")).toHaveValue("");
  await expect(info.getByRole("img", { name: "Cover" })).toBeHidden();
  await expect(info.getByRole("button", { name: "Remove" })).toBeDisabled();

  // Spotify's cover for the album's link, the large one.
  await info.getByRole("button", { name: "Use Spotify Cover" }).click();
  await expect(infoField(info, "Cover URL")).toHaveValue("https://i.scdn.co/image/ab67616d0000b273kindofblue");
  expect(lookedUp).toEqual([KIND_OF_BLUE]);
  await info.getByRole("button", { name: "OK" }).click();

  // Applied: the new cover is copied into the library, and the album points to the file.
  await expect.poll(() => keptCovers.map((c) => c.url)).toEqual(["https://i.scdn.co/image/ab67616d0000b273kindofblue"]);
  info = await openGetInfo(page);
  await info.getByRole("tab", { name: "Artwork" }).click();
  await expect(infoField(info, "Cover URL")).toHaveValue(`covers/${keptCovers[0].albumId}.jpg`);
});

test("Without a Spotify link, there is no Spotify cover to fetch", { tag: ["@album-editing.artwork"] }, async ({ page }) => {
  await openApp(page, LIBRARY);
  await clickAlbum(page, "Bootleg");
  const info = await openGetInfo(page);
  await info.getByRole("tab", { name: "Artwork" }).click();

  await expect(info.getByRole("button", { name: "Use Spotify Cover" })).toBeDisabled();

  // An address typed by hand.
  await infoField(info, "Cover URL").fill("https://covers.example.com/bootleg.jpg");
  await expect(info.getByRole("img", { name: "Cover" })).toHaveAttribute("src", "https://covers.example.com/bootleg.jpg");
});
