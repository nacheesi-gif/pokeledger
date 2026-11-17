const CACHE='pokeledger-performance-v20';
const SHELL=['./','./index.html','./explore.js','./market.js','./scanner.js','./collections.js','./hauls.js','./gallery.js','./slabs.js','./allcards.js','./restocks.js','./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png','./vendor/jsQR.js'];
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
  if(url.origin===self.location.origin && url.pathname.startsWith(new URL('./data/tcgplayer-prices/',scope).pathname) && /\/[0-9]+\.json$/.test(url.pathname)){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try{
        const response=await fetch(new Request(event.request,{cache:'no-cache'}));
        if(!response.ok)throw Error('Price snapshot unavailable');
        const copy=response.clone();
        event.waitUntil(cache.put(url.href,copy));
        return response;
      }catch{return await cache.match(url.href)||Response.error()}
    })());
    return;
  }
  if (!shellURLs.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(url.href) || fetch(event.request);
  })());
});
