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
self.addEventListener('fetch', event => { const url = new URL(event.request.url); if (event.request.method !== 'GET' || url.origin !== self.location.origin) return; event.respondWith((async () => { const cache = await caches.open(CACHE); const saved = await cache.match(event.request); if (saved) return saved; try { return await fetch(event.request); } catch (error) { if (event.request.mode === 'navigate') return await cache.match('/index.html'); throw error; } })()); });
`,
);
console.log(`Offline cache generated: ${assets.length} local assets.`);
