"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const cp=require("node:child_process");
const jsQR=require("../vendor/jsQR.js");
const read=file=>fs.readFileSync(file,"utf8");
function harness(file,extra={}){
 const window={addEventListener(){},jsQR};
 const document={head:{insertAdjacentHTML(){}},addEventListener(){},getElementById:()=>null};
 vm.runInNewContext(read(file),{window,document,URL,...extra});
 return window;
}
test("visible guide maps to the exact source pixels for portrait and landscape cameras",()=>{
 const {frameArea}=harness("scanner.js").PokeScanner;
 // 300x400 viewport, centered 200x280 guide. Landscape source is cropped by object-fit: cover.
 assert.deepEqual([...frameArea(1920,1080,300,400,50,60,200,280)],[690,162,540,756]);
 assert.deepEqual([...frameArea(1080,1920,300,400,50,60,200,280)].map(Math.round),[180,456,720,1008]);
});
function qrCanvas(blank=false){
 const modules=JSON.parse(read("tests/qr-fixture.json"));
 const size=(modules.length+8)*6,data=new Uint8ClampedArray(size*size*4).fill(255);
 if(!blank)for(let y=0;y<modules.length;y++)for(let x=0;x<modules.length;x++){
  if(!modules[y][x])continue;
  for(let py=0;py<6;py++)for(let px=0;px<6;px++){
   const i=(((y+4)*6+py)*size+(x+4)*6+px)*4;
   data[i]=data[i+1]=data[i+2]=0;
  }
 }
 return {width:size,height:size,getContext:()=>({getImageData:()=>({data,width:size,height:size})})};
}
test("actual pinned QR decoder reads synthetic PSA QR and rejects blank pixels",async()=>{
 const slabs=harness("slabs.js").PokeSlabs;
 const text=await slabs.readQR(qrCanvas());
 assert.equal(text,"https://www.psacard.com/cert/12345678");
 assert.deepEqual(JSON.parse(JSON.stringify(slabs.certFromQR(text,"CGC"))),{grader:"PSA",cert:"12345678"});
 assert.equal(await slabs.readQR(qrCanvas(true)),"");
 for(const url of ["javascript:alert(1)","https://psacard.com.evil.example/cert/12345678","http://www.psacard.com/cert/12345678","https://example.com/12345678"]){
  assert.equal(slabs.certFromQR(url,"PSA"),null);
 }
});
test("all sets use exact product IDs for cached prices and share one bucket fetch",async()=>{
 let requests=0;
 const at=new Date(Date.now()-3600000).toISOString();
 const fetch=async url=>{
  requests++;
  assert.equal(url,"./data/tcgplayer-prices/26.json");
  return {ok:true,json:async()=>({unit:"USD",updated:at,products:{"264210":{holofoil:2.79},"264211":{normal:1.25}}})};
 };
 const market=harness("market.js",{fetch}).PokeMarket;
 const first={id:"any-set-1",variants_detailed:[{thirdParty:{tcgplayer:264210}}]};
 const second={id:"another-set-2",thirdParty:{tcgplayer:264211}};
 const [a,b]=await Promise.all([market.supplement(first),market.supplement(second)]);
 assert.equal(a.pricing.tcgplayer.holofoil.marketPrice,2.79);
 assert.equal(a.pricing.tcgplayer.provider,"TCGCSV");
 assert.equal(b.pricing.tcgplayer.normal.marketPrice,1.25);
 assert.equal(requests,1);
 const unmapped={id:"unknown-card"};
 assert.equal(await market.supplement(unmapped),unmapped);
 const absent={id:"missing",thirdParty:{tcgplayer:264299}};
 assert.equal(await market.supplement(absent),absent);
});
test("cache failures, ambiguous printings and future data preserve existing quotes",async()=>{
 const native={unit:"USD",updated:new Date().toISOString(),holofoil:{marketPrice:9,productId:264210}};
 const card={id:"test-1",pricing:{tcgplayer:native},thirdParty:{tcgplayer:264210}};
 const failed=harness("market.js",{fetch:async()=>{throw Error("offline")}}).PokeMarket;
 assert.equal(await failed.supplement(card),card);
 const future=harness("market.js",{fetch:async()=>({ok:true,json:async()=>({
  unit:"USD",updated:"2099-01-01",products:{"264210":{holofoil:12}}})})}).PokeMarket;
 assert.equal(await future.supplement(card),card);
 const ambiguous=harness("market.js",{fetch:async()=>({ok:true,json:async()=>({
  unit:"USD",updated:new Date().toISOString(),products:{"264210":{holofoil:12},"264211":{holofoil:14}}})})}).PokeMarket;
 const duplicate={id:"test",variants_detailed:[{thirdParty:{tcgplayer:264210}},{thirdParty:{tcgplayer:264211}}]};
 assert.equal(await ambiguous.supplement(duplicate),duplicate);
});
test("daily price builder accepts Market Price and rejects invalid amounts and duplicate finishes",()=>{
 const result=cp.spawnSync("python3",["-B","-c",`
from scripts.sync_prices import group_prices
rows=[dict(productId=7,subTypeName='Holofoil',marketPrice=2.79,midPrice=8)]
assert group_prices(rows)=={'7':{'holofoil':2.79}}
for bad in [None,-1,float('nan'),True,'2.79']:
 assert group_prices([dict(productId=7,subTypeName='Holofoil',marketPrice=bad)])=={}
try:
 group_prices(rows+rows)
 raise AssertionError('Duplicate accepted')
except ValueError:
 pass
`],{encoding:"utf8"});
 assert.equal(result.status,0,result.stderr);
});
test("published all-set cache has consistent dates, buckets and valid USD Market Prices",()=>{
 const index=JSON.parse(read("data/tcgplayer-prices/index.json"));
 assert.ok(index.groups>=221);
 assert.ok(index.products>10000);
 let count=0;
 for(const key of index.buckets){
  const file=JSON.parse(read("data/tcgplayer-prices/"+key+".json"));
  assert.equal(file.updated,index.updated);
  assert.equal(file.unit,"USD");
  for(const [id,variants] of Object.entries(file.products)){
   assert.equal(Math.floor(Number(id)/10000),Number(key));
   count++;
   for(const value of Object.values(variants))assert.ok(Number.isFinite(value)&&value>=0);
  }
 }
 assert.equal(count,index.products);
 assert.ok(JSON.parse(read("data/tcgplayer-prices/26.json")).products["264210"].holofoil>=0);
});
