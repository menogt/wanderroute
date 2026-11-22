import assert from "node:assert/strict";
import { test } from "node:test";
import { findPlacePhoto } from "./placePhotos.ts";

const near = { latitude: 7.29, longitude: 80.64 };
function wiki(title: string, licence: string) {
  const calls: string[] = [];
  const fetchJson = async (url: string) => {
    calls.push(url);
    if (url.includes("geosearch")) return { query: { pages: [{ title, pageimage: "Photo.jpg" }] } };
    return { query: { pages: [{ imageinfo: [{ thumburl: "https://upload.wikimedia.org/x/500px-Photo.jpg?utm=1",
      descriptionurl: "https://commons.wikimedia.org/wiki/File:Photo.jpg",
      extmetadata: { LicenseShortName: { value: licence }, Artist: { value: "<a href='#'>A. Photographer</a>" } } }] }] } };
  };
  return { calls, fetchJson };
}

test("landmarks use the committed photo catalog without any lookup", async () => {
  const { calls, fetchJson } = wiki("Anything", "CC BY-SA 4.0");
  const photo = await findPlacePhoto("Nine Arches Bridge", "Ella", near, fetchJson);
  assert.match(photo?.url ?? "", /wikimedia\.org/);
  assert.equal(calls.length, 0);
});

test("a nearby article with a matching name and a free licence gives the photo, with its credit", async () => {
  const { fetchJson } = wiki("Bahirawakanda Vihara Buddha Statue", "CC BY-SA 3.0");
  const photo = await findPlacePhoto("Bahirawakanda Buddha", "Kandy", near, fetchJson);
  assert.equal(photo?.url, "https://upload.wikimedia.org/x/500px-Photo.jpg");
  assert.equal(photo?.credit, "A. Photographer");
  assert.equal(photo?.licence, "CC BY-SA 3.0");
});

test("an article about something else, a non-free photo or no coordinates give no photo", async () => {
  assert.equal(await findPlacePhoto("Bahirawakanda Buddha", "Kandy", near, wiki("Kandy City Centre", "CC BY 2.0").fetchJson), null);
  assert.equal(await findPlacePhoto("Udawattakele Forest", "Kandy", near, wiki("Udawattakele Forest Reserve", "Fair use").fetchJson), null);
  const { calls, fetchJson } = wiki("Udawattakele", "CC0");
  assert.equal(await findPlacePhoto("Udawattakele Forest", "Kandy", undefined, fetchJson), null);
  assert.equal(calls.length, 0);
});
