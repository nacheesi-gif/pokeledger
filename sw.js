const CACHE='pokeledger-performance-v16';const SHELL=['./','./index.html','./explore.js','./market.js','./scanner.js','./collections.js','./hauls.js','./gallery.js','./slabs.js','./allcards.js','./restocks.js','./manifest.webmanifest','./icon.svg'];self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([
   caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('pokeledger-')&&key!==CACHE).map(key=>caches.delete(key)))),
   self.clients.claim()
 ]));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 const path=new URL(request.url).pathname;
 const staticAsset=SHELL.some(name=>path.endsWith('/'+name.replace(/^\.\//,'')))||path.endsWith('/pokeledger/');
 if(!staticAsset)return;
 // The document is network first so a new release is discovered quickly.
 // Versioned app scripts and the icon are cache first, avoiding repeat transfers.
 if(request.mode==='navigate'||path.endsWith('/index.html')||path.endsWith('/')){
   event.respondWith(fetch(request).then(response=>{
     if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)))}
     return response;
   }).catch(()=>caches.match(request).then(found=>found||caches.match('./index.html'))));
   return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)))}
   return response;
 })));
});