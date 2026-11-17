"use strict";
const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const files=["market.js","collections.js","scanner.js","explore.js","hauls.js","gallery.js","slabs.js","allcards.js","restocks.js","sw.js"];
const html=fs.readFileSync("index.html","utf8");
for(const path of files){new vm.Script(fs.readFileSync(path,"utf8"),{filename:path});}
const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
assert.equal(inline.length,1,"one main inline application script");
for(const source of inline)new vm.Script(source,{filename:"index.html:inline"});
for(const file of files.filter(f=>f!=="sw.js"))assert.ok(html.includes('src="./'+file+'"'),file+" is loaded by HTML");
const sw=fs.readFileSync("sw.js","utf8");
for(const file of files.filter(f=>f!=="sw.js"))assert.ok(sw.includes("'./"+file+"'"),file+" is listed in service worker shell");
assert.ok(/const CACHE='pokeledger-[^']+'/.test(sw),"versioned service-worker cache");
assert.ok(html.includes("pokeledger-v1"),"retains original local data key");
new vm.Script(fs.readFileSync("vendor/jsQR.js","utf8"),{filename:"vendor/jsQR.js"});
console.log("PASS: "+files.length+" scripts, inline HTML, shell wiring, cache version and storage key");
