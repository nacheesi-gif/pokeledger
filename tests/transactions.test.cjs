"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8");

function harness(){
 const db={cards:[],statuses:{},transactions:[]},messages=[];let saves=0,seed=0;
 const window={};
 const document={head:{insertAdjacentHTML(){}},getElementById:()=>null};
 const context={window,document,db,allCards:()=>db.cards,getCard:id=>db.cards.find(c=>c.id===id),uid:()=>String(++seed),today:()=>"2026-11-16",closeModal:()=>{},save:()=>saves++,alert:msg=>messages.push(msg),console,
 FormData:class{constructor(f){return Object.entries(f.header).map(([key,val])=>[key,val])}}};
 vm.runInNewContext(read("hauls.js"),context,{filename:"hauls.js"});
 function createForm({amount=30,rows=[],owner="Me"}={}){
  return {header:{title:"Sample haul",date:"2026-11-16",amount:String(amount),owner,purpose:"Hobby / family",merchant:"Sample"},
   querySelector(query){
     if(query==='[name="amount"]')return {value:String(amount)};
     return null;
   },
   querySelectorAll(query){if(query!==".haul-line")return [];
     return rows.map(row=>({querySelector(q){const field=q.match(/name="([^"]+)"/)?.[1];return {value:String(row[field]??"")}}}));
   }};
 }
 return {api:window.PokeHauls,db,messages,createForm,getSaves:()=>saves};
}
test("itemized haul saves per-card cost/value and one total purchase",()=>{
 const h=harness();
 const f=h.createForm({rows:[
  {cardName:"Flareon ex",set:"Prismatic Evolutions",number:"14/131",qty:1,unitCost:10,marketValue:15,condition:"NM"},
  {cardName:"Jolteon ex",set:"Prismatic Evolutions",number:"12/131",qty:2,unitCost:10,marketValue:12,condition:"NM"}
 ]});
 h.api.submit(f);
 assert.equal(h.db.transactions.length,1);assert.equal(h.db.transactions[0].amount,30);
 assert.equal(h.db.cards.length,2);assert.equal(h.db.transactions[0].haulCards.length,2);
 assert.equal(h.db.statuses[h.db.cards[0].id].unitCost,10);
 assert.equal(h.db.statuses[h.db.cards[1].id].qty,2);
 assert.equal(h.db.statuses[h.db.cards[1].id].marketUnitValue,12);
 assert.equal(h.getSaves(),1);
});
test("negative haul gate blocks spending allocation greater than total paid without editing inventory",()=>{
 const h=harness();
 h.api.submit(h.createForm({amount:10,rows:[{cardName:"Eevee",set:"Set",number:"1",qty:1,unitCost:20,marketValue:30,condition:"NM"}]}));
 assert.equal(h.db.cards.length,0);assert.equal(h.db.transactions.length,0);assert.equal(h.getSaves(),0);
 assert.ok(h.messages.some(m=>m.includes("exceed")));
});
test("second purchase of same exact card blends per-copy acquisition cost without duplication",()=>{
 const h=harness();
 const first={cardName:"Eevee",set:"Set",number:"1",qty:1,unitCost:10,marketValue:14,condition:"NM"};
 const second={...first,qty:1,unitCost:5,marketValue:15};
 h.api.submit(h.createForm({amount:10,rows:[first]}));
 h.api.submit(h.createForm({amount:5,rows:[second]}));
 assert.equal(h.db.cards.length,1);const st=h.db.statuses[h.db.cards[0].id];
 assert.equal(st.qty,2);assert.equal(st.unitCost,7.5);
 assert.equal(h.db.transactions.length,2);
});
test("unknown historical acquisition cost stays unknown instead of fabricating profit",()=>{
 const h=harness();h.db.cards.push({id:"existing",name:"Eevee",set:"Set",number:"1"});
 h.db.statuses.existing={state:"Owned",qty:3,unitCost:null};
 h.api.submit(h.createForm({amount:10,rows:[{cardRef:"existing",cardName:"Eevee",set:"Set",number:"1",qty:1,unitCost:10,marketValue:20,condition:"NM"}]}));
 assert.equal(h.db.statuses.existing.qty,4);assert.equal(h.db.statuses.existing.unitCost,null);
});
test("linked sale deducts quantity and computes cost basis; unowned sale is rejected",()=>{
 const src=read("index.html"),start=src.indexOf("function submitSale("),end=src.indexOf("function openCard()",start);
 assert.ok(start>0&&end>start);
 const db={cards:[{id:"abc",name:"Eevee"}],statuses:{abc:{state:"Owned",qty:2,unitCost:7.5}},transactions:[]};let saves=0,alerts=[];
 const context={db,getCard:id=>db.cards.find(x=>x.id===id),FormData:class{constructor(f){return Object.entries(f).map(([k,v])=>[k,String(v)])}},uid:()=>"sale-id",closeModal(){},save:()=>saves++,alert:t=>alerts.push(t)};
 vm.runInNewContext(src.slice(start,end),context);
 context.submitSale({cardId:"abc",quantity:"1",amount:"25",fees:"2",shipping:"1",costBasis:"0"});
 assert.equal(db.statuses.abc.qty,1);assert.equal(db.transactions.length,1);assert.equal(db.transactions[0].costBasis,7.5);assert.equal(saves,1);
 context.submitSale({cardId:"abc",quantity:"2",amount:"25",fees:"0",shipping:"0",costBasis:"0"});
 assert.equal(db.transactions.length,1);assert.equal(db.statuses.abc.qty,1);assert.equal(saves,1);
 assert.ok(alerts.some(x=>x.includes("Not enough copies")));
});
