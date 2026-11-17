"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const names=JSON.parse(fs.readFileSync("data/card-names.json","utf8"));
function harness(extra={}){
 const window={addEventListener(){}};
 const document={head:{insertAdjacentHTML(){}},addEventListener(){},getElementById:()=>null};
 vm.runInNewContext(fs.readFileSync("scanner.js","utf8"),{window,document,URLSearchParams,...extra});
 return window.PokeScanner;
}
test("sanitized real OCR output resolves Charzard X to canonical Mega Charizard X ex",()=>{
 const scanner=harness();
 assert.equal(scanner.nameQueries("PE Worn Charzard X",names)[0],"Mega Charizard X ex");
 assert.equal(scanner.nameQueries("PE Moos Chanzard",names)[0],"Charizard");
 assert.ok(scanner.nameQueries("Gengor",names).includes("Gengar"));
 assert.ok(scanner.nameQueries("Porygon2",names).includes("Porygon2"));
 assert.equal(scanner.nameQueries("xxyzzyqbl",names).length,0);
 assert.equal(scanner.nameQueries("Lane",names).length,0);
 assert.equal(scanner.nameQueries("all Mega Charizard",names)[0],"Mega Charizard X ex");
});
test("collector parsing supports promo numbers, subsets and printed fractions",()=>{
 const scanner=harness();
 assert.equal(scanner.parseText("Mega Charizard X ex\nMEP EN 023").number,"023");
 assert.equal(scanner.parseText("TG01/TG30").number,"TG01");
 assert.equal(scanner.parseText("198/165").number,"198");
 assert.equal(scanner.parseText("HP 360\nAttack 90").number,"");
});
test("lookup uses canonical names and promotes the matching collector number",async()=>{
 const scanner=harness({fetch:async url=>{
  assert.equal(new URL(url).searchParams.get("name"),"Mega Charizard X ex");
  return {ok:true,json:async()=>[
   {id:"me02-013",name:"Mega Charizard X ex",localId:"013"},
   {id:"mep-023",name:"Mega Charizard X ex",localId:"023"}
  ]};
 }});
 const found=await scanner.findMatches(["Mega Charizard X ex"],"23");
 assert.equal(found[0].id,"mep-023");
});
test("outage is reported as an outage, and a true empty response remains empty",async()=>{
 const failed=harness({fetch:async()=>({ok:false,status:503})});
 await assert.rejects(()=>failed.findMatches(["Charizard"],""),/unavailable/);
 const empty=harness({fetch:async()=>({ok:true,json:async()=>[]})});
 assert.equal((await empty.findMatches(["Unknown"],"")).length,0);
});
test("a late OCR result after Stop never performs a lookup or replaces results",async()=>{
 let release,requests=0;
 const status={textContent:"",dataset:{}};
 const canvas={width:100,height:140,getContext:()=>({drawImage(){}})};
 const document={head:{insertAdjacentHTML(){}},addEventListener(){},createElement:()=>canvas,getElementById:id=>id==="psc-status"?status:null};
 const window={addEventListener(){},Tesseract:{createWorker:async()=>({
  setParameters:async()=>{},recognize:()=>new Promise(resolve=>{release=resolve})
 })}};
 vm.runInNewContext(fs.readFileSync("scanner.js","utf8"),{window,document,URLSearchParams,fetch:async()=>{requests++;throw Error("Unexpected lookup")}});
 const pending=window.PokeScanner.recognize(canvas);
 for(let i=0;i<5&&!release;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(typeof release,"function");
 window.pscStop();
 release({data:{text:"Charizard"}});
 await pending;
 assert.equal(requests,0);
 assert.equal(status.textContent,"Camera stopped.");
});
