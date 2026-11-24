import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const assets = [
  ["favicon-16x16.png", 16, true, "rounded"],
  ["favicon-32x32.png", 32, true, "rounded"],
  ["favicon-96x96.png", 96, true, "rounded"],
  ["apple-touch-icon.png", 180, true, "full"],
  ["android-chrome-192x192.png", 192, true, "rounded"],
  ["android-chrome-512x512.png", 512, true, "rounded"],
  ["pwa/icon-any-192x192.png", 192, false, "rounded"],
  ["pwa/icon-any-512x512.png", 512, false, "rounded"],
  ["pwa/icon-maskable-512x512.png", 512, false, "full"],
];
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const assertCornerAlpha = async (data, label, expected) => {
  const { data: pixels, info } = await sharp(data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const [x, y] of [[0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1]]) {
    const alpha = pixels[(y * info.width + x) * info.channels + 3];
    if (expected === "rounded") assert.equal(alpha, 0, `${label} corner (${x},${y}) must be transparent`);
    else assert.equal(alpha, 255, `${label} corner (${x},${y}) must be opaque`);
  }
};
for (const [name, size, inRootMetadata, cornerStyle] of assets) {
  const data = await readFile(new URL(`../public/${name}`, import.meta.url));
  const metadata = await sharp(data).metadata();
  assert.equal(metadata.format, "png", name);
  assert.equal(metadata.width, size, name);
  assert.equal(metadata.height, size, name);
  if (inRootMetadata) assert.ok(layout.includes(`/${name}`), `${name} must be declared in root metadata`);
  await assertCornerAlpha(data, name, cornerStyle);
}

const ico = await readFile(new URL("../public/favicon.ico", import.meta.url));
assert.deepEqual(await readFile(new URL("../app/favicon.ico", import.meta.url)), ico,
  "Next.js route and public favicon must match");
assert.ok(layout.includes("/favicon.ico"), "root metadata must declare the ICO favicon");
assert.equal(ico.readUInt16LE(2), 1, "ICO image type");
const icoSizes = Array.from({ length: ico.readUInt16LE(4) }, (_, index) => {
  const offset = 6 + index * 16;
  return [ico[offset] || 256, ico[offset + 1] || 256];
});
for (let index = 0; index < icoSizes.length; index++) {
  const [width, height] = icoSizes[index];
  assert.ok([16, 32, 48, 96].includes(width) && width === height, `ICO frame ${width}x${height}`);
  const entry = 6 + index * 16;
  const length = ico.readUInt32LE(entry + 8);
  const offset = ico.readUInt32LE(entry + 12);
  await assertCornerAlpha(ico.subarray(offset, offset + length), `ICO ${width}px`, "rounded");
}

const manifest = JSON.parse(await readFile(new URL("../public/site.webmanifest", import.meta.url), "utf8"));
assert.equal(manifest.name, "Growvelt Learning");
assert.equal(manifest.short_name, "Growvelt");
assert.equal(manifest.id, "/");
assert.equal(manifest.start_url, "/");
assert.equal(manifest.scope, "/");
for (const size of [192, 512]) {
  assert.ok(manifest.icons.some(icon => icon.src === `/android-chrome-${size}x${size}.png?v=10`
    && icon.sizes === `${size}x${size}` && icon.type === "image/png" && icon.purpose === "any"));
}
assert.ok(manifest.icons.some(icon => icon.src === "/pwa/icon-maskable-512x512.png?v=10"
  && icon.sizes === "512x512" && icon.type === "image/png" && icon.purpose === "maskable"),
  "maskable PWA icon must be declared in the manifest");
const sw = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
assert.match(sw, /CACHE_VERSION\s*=\s*["']v11["']/, "service worker cache must refresh updated icons and offline page");
for (const path of ["/favicon.ico", "/favicon-16x16.png", "/favicon-32x32.png", "/favicon-96x96.png",
  "/android-chrome-192x192.png", "/android-chrome-512x512.png", "/apple-touch-icon.png",
  "/pwa/icon-any-192x192.png", "/pwa/icon-any-512x512.png", "/pwa/icon-maskable-512x512.png"]) {
  assert.ok(sw.includes(path), `${path} must remain in the service worker cache allowlist`);
}

const offline = await readFile(new URL("../public/offline.html", import.meta.url), "utf8");
assert.ok(offline.includes('src="/android-chrome-192x192.png?v=10"'), "offline screen must use the Learning icon");
assert.match(sw, /icon:\s*["']\/pwa\/icon-any-192x192\.png\?v=10["']/, "push notifications must use the Learning icon");

const legacyManifest = JSON.parse(await readFile(new URL("../../images/site.webmanifest", import.meta.url), "utf8"));
assert.equal(legacyManifest.name, "Growvelt Learning");
assert.equal(legacyManifest.short_name, "Growvelt");
assert.equal(legacyManifest.id, "/");
assert.equal(legacyManifest.start_url, "/");
assert.equal(legacyManifest.scope, "/");
for (const [size, purpose, file, cornerStyle] of [
  [192, "any", "android-chrome-192x192.png", "rounded"],
  [512, "any", "android-chrome-512x512.png", "rounded"],
  [512, "maskable", "icon-maskable-512x512.png", "full"],
]) {
  const path = `/images/${file}`;
  assert.ok(legacyManifest.icons.some(icon => icon.src === `${path}?v=10` && icon.sizes === `${size}x${size}`
    && icon.type === "image/png" && icon.purpose === purpose), `${path} must be declared in the legacy Learning manifest`);
  const data = await readFile(new URL(`../../images/${file}`, import.meta.url));
  const metadata = await sharp(data).metadata();
  assert.equal(metadata.width, size, path);
  assert.equal(metadata.height, size, path);
  await assertCornerAlpha(data, path, cornerStyle);
}
assert.deepEqual(await readFile(new URL("../../images/favicon.ico", import.meta.url)), ico,
  "legacy static Learning pages must use the same favicon");

console.log("PASS: icon sizes, transparency, ICO synchronization, both manifests, offline screen, notifications, paths and cache refresh");
