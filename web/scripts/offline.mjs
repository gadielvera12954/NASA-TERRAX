import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : join(dir, e.name),
      ),
    )
  ).flat();
}
const paths = (await walk("dist")).filter((p) => !p.endsWith("sw.js"));
const hash = createHash("sha256");
for (const p of paths) hash.update(await readFile(p));
const cache = `terra-mvp-${hash.digest("hex").slice(0, 12)}`;
const assets = [
  "/",
  ...paths.map((p) => "/" + p.replaceAll("\\", "/").replace(/^dist\//, "")),
];
await writeFile(
  "dist/sw.js",
  `const CACHE = ${JSON.stringify(cache)};
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil((async () => { for (const key of await caches.keys()) if (key.startsWith('terra-mvp-') && key !== CACHE) await caches.delete(key); await self.clients.claim(); for (const client of await self.clients.matchAll()) client.postMessage('OFFLINE_READY'); })()));
self.addEventListener('message', event => { if (event.data === 'CHECK_READY') event.source?.postMessage('OFFLINE_READY'); });
const bundled = new Set(ASSETS);
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!bundled.has(url.pathname) && request.mode !== 'navigate') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Bundled resources are public and byte-identical across same-origin request modes.
    // A module request can carry Origin even when the precache request did not.
    if (bundled.has(url.pathname)) {
      const saved = await cache.match(url.pathname, { ignoreVary: true });
      if (saved) return saved;
    }
    try { return await fetch(request); }
    catch (error) {
      if (request.mode === 'navigate') {
        const shell = await cache.match('/index.html', { ignoreVary: true });
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
`,
);
console.log(`Offline cache generated: ${assets.length} local assets.`);
