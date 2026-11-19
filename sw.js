const CACHE='pokeledger-performance-v30';
const SHELL=['./','./index.html','./ledger.js','./sprites-gen3.png','./artwork.js','./psa-logo.svg','./cgc-logo.svg','./card-placeholder.svg','./ledger.css','./collections.js','./hauls.js','./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png','./fonts/archivo-black.ttf'];
const scope = self.registration.scope;
const shellURLs = new Set(SHELL.map(path => new URL(path, scope).href));

self.addEventListener('install', event => {
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
  if (isArtwork(url)) {event.respondWith(artworkResponse(event.request));return;}
  url.search = '';
  if (!shellURLs.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(url.href) || fetch(event.request);
  })());
});

// Keep image data separate from the app shell and financial records.
const ART_CACHE = 'pokeledger-artwork-v1';
const ART_LIMIT = 180, ART_BYTES = 24 * 1024 * 1024;
const artPending = new Map();
let artWrites = Promise.resolve();
function isArtwork(url) {
  return url.origin === 'https://assets.tcgdex.net' && !url.search &&
    /^\/(en|ja)\/[a-zA-Z0-9.+_-]+\/[a-zA-Z0-9.+_-]+\/[a-zA-Z0-9.+_-]+\/(low|high)\.webp$/.test(url.pathname);
}
async function trimArtwork(cache) {
  const keys = await cache.keys();
  let bytes = 0;
  const sizes = [];
  for (const key of keys) {
    const response = await cache.match(key);
    const size = Number(response?.headers.get('x-pokeledger-bytes')) || ART_BYTES;
    sizes.push(size);bytes += size;
  }
  let count = keys.length;
  for (let i=0; i<keys.length && (count>ART_LIMIT || bytes>ART_BYTES);i++) {
    await cache.delete(keys[i]);bytes-=sizes[i];count--;
  }
}
async function artworkResponse(request) {
  const url = request.url;
  try {
    const cache = await caches.open(ART_CACHE), cached = await cache.match(url);
    if (cached) return cached;
  } catch {} // Disabled/full storage must never block artwork or records.
  if (artPending.has(url)) return (await artPending.get(url)).clone();
  const task = (async()=>{
    try {
      // Readable responses avoid opaque-response quota padding (often megabytes per image).
      const response = await fetch(url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer'});
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw Error('Image unavailable');
      const blob = await response.blob();
      const headers = new Headers(response.headers);headers.set('x-pokeledger-bytes',String(blob.size));
      const copy = new Response(blob,{status:200,headers});
      if (blob.size <= 1024*1024) {
        const stored = copy.clone();
        artWrites = artWrites.catch(()=>{}).then(async()=>{
          const cache = await caches.open(ART_CACHE);await cache.put(url,stored);await trimArtwork(cache);
        }).catch(()=>{});
        await artWrites;
      }
      return copy;
    } catch {
      // A few provider images have malformed CORS headers. Display those uncached.
      try {return await fetch(request);} catch {
        try {
          const images = await caches.open(ART_CACHE);
          const low = await images.match(url.replace('/high.webp','/low.webp'));
          if (low) return low;
          const shell = await caches.open(CACHE);return await shell.match(new URL('./card-placeholder.svg',scope).href) || Response.error();
        } catch {return Response.error();}
      }
    }
  })();
  artPending.set(url,task);
  try {return (await task).clone();} finally {artPending.delete(url);}
}
