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
// Only Vite's hashed files (/assets/name-HASH.js|css) never change under the same name: those are
// served from the cache. The page itself and every unhashed file (data, models, images) go to the
// network first, so a new deploy shows up on the next load; the cache answers only when offline.
const inmutable = (path) => path.startsWith('/assets/');
const LIMITE_MS = 6000;
function conLimite(promesa) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), LIMITE_MS);
    promesa.then((r) => { clearTimeout(t); resolve(r); }, (e) => { clearTimeout(t); reject(e); });
  });
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const navegacion = request.mode === 'navigate';
  if (!bundled.has(url.pathname) && !navegacion) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Bundled resources are public and byte-identical across same-origin request modes.
    // A module request can carry Origin even when the precache request did not.
    if (inmutable(url.pathname)) {
      const saved = await cache.match(url.pathname, { ignoreVary: true });
      if (saved) return saved;
      return fetch(request);
    }
    const clave = navegacion ? (bundled.has(url.pathname) ? url.pathname : '/') : url.pathname;
    try {
      const fresca = await conLimite(fetch(request));
      if (fresca.ok && fresca.type === 'basic') cache.put(clave, fresca.clone()).catch(() => {});
      return fresca;
    } catch (error) {
      const saved = (await cache.match(clave, { ignoreVary: true }))
        || (navegacion ? (await cache.match('/index.html', { ignoreVary: true })) || (await cache.match('/', { ignoreVary: true })) : undefined);
      if (saved) return saved;
      throw error;
    }
  })());
});
`,
);
console.log(`Offline cache generated: ${assets.length} local assets.`);
