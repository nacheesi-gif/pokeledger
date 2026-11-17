"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8");
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function galleryHarness(){
 const window={};
 const document={readyState:"loading",head:{insertAdjacentHTML(){}},addEventListener(){}};
 const context={window,document,db:{statuses:{}},console};
 vm.runInNewContext(read("gallery.js"),context,{filename:"gallery.js"});
 return {gallery:window.PokeGallery,db:context.db};
}
test("price gate: recent single variant is accepted and dated",()=>{
 const {gallery}=galleryHarness();
 const x=gallery.sources({pricing:{tcgplayer:{updated:new Date().toISOString(),normal:{marketPrice:25}}}});
 assert.equal(x.label,"$25.00");assert.equal(x.stale,false);assert.equal(x.price,25);
});
test("price gate: stale and absent quotes are not current prices",()=>{
 const {gallery}=galleryHarness();
 const old=gallery.sources({pricing:{tcgplayer:{updated:"2020-01-01T00:00:00Z",normal:{marketPrice:500}}}});
 const missing=gallery.sources({});
 assert.equal(old.stale,true);assert.equal(old.price,null);
 assert.match(old.label,/Old/);
 assert.equal(missing.price,null);assert.match(missing.label,/Check price/);
});
test("price gate: ambiguous finishes show lowest FROM estimate rather than one authoritative variant",()=>{
 const {gallery}=galleryHarness();
 const d=gallery.sources({pricing:{tcgplayer:{updated:new Date().toISOString(),normal:{marketPrice:12},holofoil:{marketPrice:19}}}});
 assert.equal(d.label,"From $12.00");assert.equal(d.price,null);
});
test("saved binder market value remains explicitly labeled as saved",()=>{
 const {gallery,db}=galleryHarness();db.statuses.owned={marketUnitValue:17.5,marketAsOf:"2026-11-01"};
 assert.match(gallery.badge("sv01-1","owned"),/17\.50/);
 assert.match(gallery.badge("sv01-1","owned"),/saved/);
 assert.doesNotMatch(gallery.badge("sv01-1","owned"),/data-pkprice/);
});
test("dashboard realized profit excludes unrealized cards and unknown-cost sales",()=>{
 const html=read("index.html");
 const start=html.indexOf("function valuedInventory()");
 const end=html.indexOf("async function refreshRawOwnedPrices",start);
 assert.ok(start>=0&&end>start,"dashboard calculation boundary");
 const db={statuses:{a:{qty:2,unitCost:5,marketUnitValue:20},b:{qty:1,unitCost:null,marketUnitValue:999}},transactions:[
 {kind:"purchase",amount:10,date:"2026-11-16",purpose:"Hobby"},
 {kind:"sale",amount:30,fees:2,shipping:3,costBasis:10,date:"2026-11-16"},
 {kind:"sale",amount:90,fees:1,costBasis:null,date:"2026-11-16"}
 ]};
 const context={db,ownedCards:()=>[{id:"a"},{id:"b"}],today:()=> "2026-11-16",Number,Math,purchase:t=>t.kind==="purchase",sale:t=>t.kind==="sale",cashout:t=>t.kind==="cashout",txSum:fn=>db.transactions.filter(fn).reduce((a,t)=>a+(Number(t.amount)||0),0)};
 const js=html.slice(start,end);
 // Validate the real functions without running the app's DOM/bootstrap code.
 vm.runInNewContext(js,context,{filename:"dashboard-calculations.js"});
 const inv=context.valuedInventory();
 assert.equal(inv.gain,30);assert.equal(inv.cost,10);assert.equal(inv.value,40);assert.equal(inv.missing,1);
 const m=context.metrics();assert.equal(m.realized,15);assert.equal(m.knownSales,1);assert.equal(m.unknownSales,1);
});
test("negative accounting case: unknown cost cannot produce a fake positive inventory gain",()=>{
 const src=read("index.html"),start=src.indexOf("function valuedInventory()"),end=src.indexOf("function metrics()",start);
 const context={db:{statuses:{a:{qty:3,unitCost:null,marketUnitValue:1000}}},ownedCards:()=>[{id:"a"}],Number,Math};
 vm.runInNewContext(src.slice(start,end),context);
 const v=context.valuedInventory();assert.equal(v.value,0);assert.equal(v.gain,0);assert.equal(v.missing,3);
});
function restockHarness(){
 const db={},window={},doc={head:{insertAdjacentHTML(){}},getElementById:()=>null};let saved=0;
 const context={window,document:doc,db,save:()=>saved++};
 vm.runInNewContext(read("restocks.js"),context,{filename:"restocks.js"});
 return {api:window.PokeRestocks,db,window,saved:()=>saved};
}
test("restock preferences persist without creating transactions or changing ownership",()=>{
 const h=restockHarness();
 assert.match(h.api.render(),/Ascended Heroes/);
 h.api.changeSet("paldea");h.api.changeStore("Best Buy");
 assert.ok(!h.db.restockWatch.sets.includes("paldea"));
 assert.ok(!h.db.restockWatch.retailers.includes("Best Buy"));
 assert.equal(h.saved(),2);assert.equal(h.db.transactions,undefined);
});
test("restock watch rejects unknown retailer and unknown set",()=>{
 const h=restockHarness();h.api.render();
 const original=h.saved();h.api.changeStore("Mystery Shop");h.api.changeSet("fake-set");
 assert.equal(h.saved(),original);
});
function allHarness(){
 const db={cards:[],statuses:{},members:["Me"]},window={scrollTo(){},PokeGallery:{badge:()=>"<span>market $2</span>"},PokeMarket:{load:async()=>({set:{id:"sv01",name:"Scarlet & Violet"},rarity:"Common"})}};
 let dom="",storageReads=0,saveCalls=0;
 const document={getElementById:id=>id==="px-main"?{set innerHTML(v){dom=v}}:null};
 const cards=Array.from({length:49},(_,i)=>({id:"sv01-"+(i+1),name:"Card "+(i+1),localId:String(i+1),image:"https://assets.tcgdex.net/en/sv/sv01/"+(i+1)}));
 const fetch=async url=>({ok:true,json:async()=>String(url).includes("pagination%3Apage=2")||String(url).includes("pagination:page=2")?[cards[48]]:cards.slice(0,48)});
 const localStorage={getItem(){storageReads++;return JSON.stringify({sets:[{id:"sv01",name:"Scarlet & Violet",cardCount:{official:198}}]})}};
 const context={window,document,db,localStorage,fetch,URLSearchParams,allCards:()=>db.cards,save:()=>saveCalls++,render(){dom=window.PokeAllCards.render()},uid:()=>"test",setTimeout,clearTimeout,console};
 vm.runInNewContext(read("allcards.js"),context,{filename:"allcards.js"});
 return {api:window.PokeAllCards,db,getDOM:()=>dom,getReads:()=>storageReads,getSaved:()=>saveCalls};
}
test("all cards loads pages with a bounded set-catalog lookup and adds owned copy",async()=>{
 const h=allHarness();h.api.open();await flush();await flush();
 assert.match(h.getDOM(),/Card 48/);h.api.more();await flush();await flush();
 assert.match(h.getDOM(),/Card 49/);assert.equal(h.getReads(),1);
 await h.api.add("sv01-1");assert.equal(h.db.statuses["ex-sv01-1"].qty,1);
 await h.api.add("sv01-1");assert.equal(h.db.statuses["ex-sv01-1"].qty,2);
 assert.equal(h.db.cards.length,1);assert.equal(h.getSaved(),2);
});
test("negative all-cards case: unknown card cannot modify owned inventory",async()=>{
 const h=allHarness();h.api.open();await flush();await h.api.add("not-a-card");
 assert.equal(h.db.cards.length,0);assert.equal(h.getSaved(),0);
});
