const CACHE='pokeledger-performance-v18';
const SHELL=['./','./index.html','./explore.js','./market.js','./scanner.js','./collections.js','./hauls.js','./gallery.js','./slabs.js','./allcards.js','./restocks.js','./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png'];
const scope = self.registration.scope;
const shellURLs = new Set(SHELL.map(path => new URL(path, scope).href));

self.addEventListener('install', event => {
  // Keep an open ledger on one release until its windows have closed.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(
    SHELL.map(path => new Request(new URL(path, scope), {cache: 'reload'}))
  )));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('pokeledger-performance-') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  url.search = '';
  if (!shellURLs.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(url.href) || fetch(event.request);
  })());
});
