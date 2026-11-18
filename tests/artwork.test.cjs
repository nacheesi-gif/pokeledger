const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function app(){const window={};vm.runInNewContext(fs.readFileSync('artwork.js','utf8'),{window,URLSearchParams});return window.PokeArtwork;}
const card={id:'base1-4',name:'Charizard',localId:'4',image:'https://assets.tcgdex.net/en/base/base1/4'};
test('artwork accepts an exact catalog reference; rejects untrusted and malformed image URLs',()=>{
 const a=app(),c=a.clean(card);assert.equal(c.number,'4');assert.equal(c.setId,'base1');
 assert.equal(a.clean({...card,image:'https://evil.test/image'}),null);
 assert.equal(a.clean({...card,image:card.image+'?tracking=1'}),null);
 assert.equal(a.clean({...card,image:'javascript:alert(1)'}),null);
 assert.equal(a.clean({...card,id:'"><script>'}),null);
 assert.equal(a.clean(null),null);
 assert.equal(a.clean(JSON.parse(JSON.stringify(c))).id,c.id);
 const form={elements:{artwork:{value:JSON.stringify(c)}}};assert.equal(a.read(form).id,c.id);
 form.elements.artwork.value='broken';assert.throws(()=>a.read(form),/choose/);
 assert.equal(a.read({elements:{}}),undefined);
});
test('grades parse compact labels and pristine typo, but never infer a grade from raw, ambiguous or invalid labels',()=>{
 const a=app();
 for(const [label,want] of [['PSA10','PSA 10'],['psa 9 slab','PSA 9'],['CGC Pristine 10','CGC Pristine 10'],['cgc pristien 10','CGC Pristine 10'],['CGC 10','CGC 10'],['CGC 9.5 slab','CGC 9.5']])assert.equal(a.grade(label).label,want);
 for(const label of ['Raw','Boosters','PSA 11','PSA 100','PSA 10.5','PSA','CGC Pristine 9','PSA 10 / CGC 10','raw PSA10 potential','not PSA10','PSA10?'])assert.equal(a.grade(label),null,label);
 assert.match(a.badge('PSA10'),/psa-logo.svg/);assert.match(a.badge('CGC pristine 10'),/cgc-logo.svg/);
 assert.equal(a.badge('Raw'),'');
});
test('search is paginated, validates inputs and safely encodes names; HTML remains escaped',()=>{
 const a=app(),url=new URL(a.searchURL('Pikachu & Eevee','TG01','en',2));
 assert.equal(url.searchParams.get('pagination:itemsPerPage'),'12');assert.equal(url.searchParams.get('name'),'like:Pikachu & Eevee');assert.equal(url.searchParams.get('localId'),'1');
 assert.throws(()=>a.searchURL('a','','en',1));assert.throws(()=>a.searchURL('Pikachu','','bad',1));
 const html=a.thumb({id:'" onclick="evil()',artwork:{...card,name:'<img onerror=evil()>'}});
 assert.ok(!html.includes('<img onerror=evil()>'));assert.match(html,/&lt;img/);
 assert.equal(a.thumb({}), '');
});
function worker(fetcher,broken=false){
 const entries=new Map();const cache={match:async k=>entries.get(typeof k==='string'?k:k.url)?.clone(),put:async(k,r)=>{entries.set(k,r.clone());},keys:async()=>[...entries.keys()].map(url=>({url})),delete:async k=>entries.delete(typeof k==='string'?k:k.url)};
 const box={URL,Response,Headers,Map,Promise,fetch:fetcher,caches:{open:async()=>{if(broken)throw Error('quota');return cache;}},self:{registration:{scope:'https://example.test/pokeledger/'},addEventListener(){}}};
 vm.createContext(box);vm.runInContext(fs.readFileSync('sw.js','utf8')+'\nthis.api={artworkResponse,isArtwork,trimArtwork};',box);return {...box.api,cache,entries};
}
test('artwork cache reuses images offline, deduplicates requests and excludes opaque responses',async()=>{
 let calls=0,online=true;
 const w=worker(async()=>{calls++;if(!online)throw Error('offline');return new Response('pixels',{headers:{'content-type':'image/webp'}})});
 const request=new Request(card.image+'/low.webp');
 const [one,two]=await Promise.all([w.artworkResponse(request),w.artworkResponse(request)]);assert.equal(await one.text(),'pixels');assert.equal(await two.text(),'pixels');assert.equal(calls,1);
 online=false;assert.equal(await (await w.artworkResponse(request)).text(),'pixels');assert.equal(calls,1);
 assert.equal(w.isArtwork(new URL(request.url)),true);assert.equal(w.isArtwork(new URL('https://evil.test/low.webp')),false);
 const broken=worker(async()=>new Response('live',{headers:{'content-type':'image/webp'}}),true);assert.equal(await(await broken.artworkResponse(request)).text(),'live');
 const opaque=worker(async(url,options)=>{if(options)throw Error('CORS');return new Response('uncached')});await opaque.artworkResponse(request);assert.equal(opaque.entries.size,0);
});
test('artwork cache evicts oldest images at its byte and entry limits',async()=>{
 const w=worker(()=>{});
 for(let i=0;i<181;i++)await w.cache.put('https://example.test/'+i,new Response('x',{headers:{'x-pokeledger-bytes':'1'}}));
 await w.trimArtwork(w.cache);assert.equal(w.entries.size,180);assert.equal(w.entries.has('https://example.test/0'),false);
 w.entries.clear();for(let i=0;i<3;i++)await w.cache.put('https://example.test/'+i,new Response('x',{headers:{'x-pokeledger-bytes':String(10*1024*1024)}}));
 await w.trimArtwork(w.cache);assert.equal(w.entries.size,2);
});

test('missing artwork remains selectable and uses only an unambiguous standard product mapping',()=>{
 const a=app(),missing=a.clean({id:'mep-023',name:'Mega Charizard X ex',localId:'023'});
 assert.ok(missing);assert.equal(missing.image,'');assert.equal(a.imageURL(missing),'./card-placeholder.svg');
 const detail={id:'mep-023',variants_detailed:[{size:'standard',thirdParty:{tcgplayer:659612}}]};
 const fixed=a.withProductImage(missing,detail);
 assert.equal(a.imageURL(fixed),'https://tcgplayer-cdn.tcgplayer.com/product/659612_in_400x400.jpg');
 assert.equal(a.clean(JSON.parse(JSON.stringify(fixed))).image,fixed.image);
 assert.equal(a.withProductImage(missing,{...detail,id:'mep-029'}).image,'');
 assert.equal(a.withProductImage(missing,{...detail,variants_detailed:[...detail.variants_detailed,{size:'standard',thirdParty:{tcgplayer:123}}]}).image,'');
 assert.equal(a.withProductImage(missing,{...detail,variants_detailed:[{size:'jumbo',thirdParty:{tcgplayer:123}}]}).image,'');
 assert.equal(a.clean({...fixed,image:fixed.image+'?tracking=1'}),null);
});
test('number-only, leading-zero, set-prefix and fraction searches match the actual collector number',()=>{
 const a=app(),promo={id:'mep-023',localId:'023'};
 for(const value of ['023','23','#023','MEP 023','023/094']) {
  assert.equal(a.numberMatches(promo,value),true,value);
  assert.equal(a.numberMatches({id:'sv03-223',localId:'223'},value),false,value);
 }
 assert.equal(a.numberMatches({id:'swsh9tg-TG01',localId:'TG01'},'TG01'),true);
 assert.equal(a.numberMatches({id:'base1-1',localId:'1'},'TG01'),false);
 const u=new URL(a.searchURL('','#023','en',1));assert.equal(u.searchParams.get('localId'),'23');assert.equal(u.searchParams.has('name'),false);
 assert.throws(()=>a.searchURL('','','en',1));
});
