import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const assets = [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["apple-touch-icon.png", 180],
  ["android-chrome-192x192.png", 192],
  ["android-chrome-512x512.png", 512],
];
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
for (const [name, size] of assets) {
  const data = await readFile(new URL(`../public/${name}`, import.meta.url));
  const metadata = await sharp(data).metadata();
  assert.equal(metadata.format, "png", name);
  assert.equal(metadata.width, size, name);
  assert.equal(metadata.height, size, name);
  assert.ok(layout.includes(`/${name}`), `${name} must be declared in root metadata`);
}

const ico = await readFile(new URL("../public/favicon.ico", import.meta.url));
assert.deepEqual(await readFile(new URL("../app/favicon.ico", import.meta.url)), ico,
  "Next.js route and public favicon must match");
assert.equal(ico.readUInt16LE(2), 1, "ICO image type");
const icoSizes = Array.from({ length: ico.readUInt16LE(4) }, (_, index) => {
  const offset = 6 + index * 16;
  return [ico[offset] || 256, ico[offset + 1] || 256];
});
for (const size of [16, 32, 48]) {
  assert.ok(icoSizes.some(([width, height]) => width === size && height === size), `ICO ${size}px`);
}

const manifest = JSON.parse(await readFile(new URL("../public/site.webmanifest", import.meta.url), "utf8"));
assert.equal(manifest.name, "Growvelt Learning");
assert.equal(manifest.short_name, "Growvelt");
for (const size of [192, 512]) {
  assert.ok(manifest.icons.some(icon => icon.src === `/android-chrome-${size}x${size}.png`
    && icon.sizes === `${size}x${size}` && icon.type === "image/png" && icon.purpose === "any"));
}
console.log("PASS: favicon dimensions, metadata, ICO synchronization and mobile manifest");
