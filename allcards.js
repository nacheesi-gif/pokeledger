(function(){
"use strict";
const API="https://api.tcgdex.net/v2/en";
const E=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safe=v=>String(v||"").replace(/[^a-zA-Z0-9._+-]/g,"");
const x={active:false,cards:[],page:0,hasMore:true,busy:false,error:"",query:"",timer:null,serial:0,owner:"Me",details:{}};
function sets(){try{return JSON.parse(localStorage.getItem("pokeledger-explore-cache-v1")||"{}").sets||[]}catch{return []}}
function setFor(c){const id=String(c.id||"");return sets().find(s=>id.startsWith(s.id+"-"))||{id:id.slice(0,id.lastIndexOf("-")),name:id.slice(0,id.lastIndexOf("-"))}}
function owned(c){return allCards().find(z=>z.tcgdexId===c.id||z.id==="ex-"+c.id)}
function isOwned(c){const z=owned(c);return z&&["Owned","Grading"].includes(db.statuses[z.id]?.state)}
function num(c){const s=setFor(c);return String(c.localId||"?")+(s.cardCount?.official?"/"+s.cardCount.official:"")}
function card(id){const c=x.cards.find(v=>v.id===id);return c?{...c,set:setFor(c).name,number:num(c)}:null}
async function fetchPage(reset=false){
 if(!x.active||x.busy)return;
 const serial=++x.serial;
 if(reset){x.cards=[];x.page=0;x.hasMore=true;}
 x.busy=true;x.error="";draw();
 const params=new URLSearchParams({"pagination:page":String(x.page+1),"pagination:itemsPerPage":"48"});
 if(x.query.trim())params.set("name",x.query.trim());
 try{
  const res=await fetch(API+"/cards?"+params.toString(),{headers:{"Accept":"application/json"}});
  if(!res.ok)throw new Error("Card catalog returned "+res.status);
  const data=await res.json();
  if(!Array.isArray(data))throw new Error("Unexpected response from card catalog");
  if(serial!==x.serial||!x.active)return;
  const present=new Set(x.cards.map(c=>c.id));
  for(const item of data){if(item?.id&&!present.has(item.id)){x.cards.push(item);present.add(item.id)}}
  x.page++;x.hasMore=data.length===48;
 }catch(e){if(serial===x.serial)x.error="Unable to load cards: "+e.message+". Please try again."}
 finally{if(serial===x.serial){x.busy=false;draw()}}
}
function search(value){
 x.query=value;
 if(x.timer)clearTimeout(x.timer);
 x.timer=setTimeout(()=>{x.busy=false;x.serial++;fetchPage(true)},400);
}
function open(){x.active=true;x.cards=[];x.page=0;x.hasMore=true;x.query="";x.serial++;x.owner="Me";render();fetchPage(true);window.scrollTo(0,0)}
function back(){x.active=false;x.serial++;if(x.timer)clearTimeout(x.timer);render();window.scrollTo(0,0)}
function more(){fetchPage(false)}
function owner(v){x.owner=v}
function cardBox(c){
 const z=owned(c),yes=isOwned(c),q=yes?Number(db.statuses[z.id]?.qty||1):0;
 const id=safe(c.id),image=c.image?E(c.image.replace(/\/(low|high)\.(png|webp)$/i,"")+"/low.webp"):"";
 const art=image?'<img loading="lazy" class="px-art" src="'+image+'" alt="'+E(c.name)+'" onerror="this.style.display=\'none\'">':'<div class="px-noimage">Image unavailable</div>';
 return '<article class="px-card"><div class="px-artbox"><button type="button" class="pk-card-tap" onclick="pkZoom(\''+id+'\',\'all\')" aria-label="Enlarge '+E(c.name)+'">'+art+'</button>'+(yes?'<span class="px-owned">✓ OWNED</span>':'')+'</div><div class="px-cardinfo"><strong>'+E(c.name)+'</strong><small>'+E(setFor(c).name)+' · '+E(num(c))+'</small>'+window.PokeGallery.badge(id,z?.id)+'<button class="px-add '+(yes?'yes':'')+'" onclick="paAdd(\''+id+'\')">'+(yes?'✓ Owned · Add another':'+ Add to My Binder')+'</button><button class="px-add px-market" onclick="pmOpen(\''+id+'\')">Market & sold links ↗</button>'+(yes?'<small>Qty: '+q+'</small>':'')+'</div></article>';
}
function view(){
 return '<button class="btn sm" onclick="paBack()">← Back to set galleries</button>'+
 '<header class="px-head px-selected"><div><span class="px-kicker">EVERY EXPANSION · EVERY GALLERY</span><h1>All Cards</h1><p>Browse Pokémon cards together from every set, or return to individual gallery categories.</p></div></header>'+
 '<div class="px-controls"><input class="field" type="search" id="pa-search" placeholder="Search across ALL cards by name…" aria-label="Search all cards" value="'+E(x.query)+'" oninput="paSearch(this.value)"><select class="field" onchange="paOwner(this.value)" aria-label="Assign to profile">'+db.members.map(m=>'<option '+(m===x.owner?'selected':'')+' value="'+E(m)+'">For '+E(m)+'</option>').join("")+'</select></div>'+
 '<div class="px-status">'+x.cards.length+' cards loaded '+(x.query?'for “'+E(x.query)+'”':'across all sets')+' · browse more below</div>'+
 (x.error?'<p class="px-empty">'+E(x.error)+'</p>':'')+
 '<div class="px-cardgrid">'+x.cards.map(cardBox).join("")+'</div>'+
 (x.busy?'<div class="px-empty">Loading cards…</div>':x.hasMore?'<button class="btn px-more" onclick="paMore()">Show More Cards</button>':x.cards.length?'<div class="px-note">You have reached the end of these results.</div>':'<div class="px-empty">No matching cards found.</div>')+
 '<div class="px-note">Search queries the full TCGdex catalog, not only loaded cards. Market values are available where reported by the pricing source.</div>';
}
function draw(){
 if(!x.active)return;
 const host=document.getElementById("px-main");if(host)host.innerHTML=view();
}
async function add(id){
 const item=x.cards.find(c=>c.id===id);if(!item)return;
 const prior=owned(item);
 let detail;
 try{detail=await window.PokeMarket.load(item.id)}catch{detail=null}
 const set=detail?.set||setFor(item);
 const cardData=prior||{id:"ex-"+item.id,tcgdexId:item.id,name:item.name,set:set?.name||"Unknown",setId:set?.id||"",number:detail?.localId||num(item),category:detail?.rarity||"Other",rarity:detail?.rarity||"",illustrator:detail?.illustrator||"",image:item.image?item.image+"/low.webp":"",referencePrice:null,rank:null};
 if(!prior)db.cards.push(cardData);
 const previous=db.statuses[cardData.id]||{},qty=["Owned","Grading"].includes(previous.state)?Math.max(1,Number(previous.qty)||0):0;
 db.statuses[cardData.id]={...previous,state:"Owned",qty:qty+1,owner:x.owner,condition:previous.condition||"NM"};
 save();draw();
}
window.PokeAllCards={get active(){return x.active},render:view,open,back,card,add,search,more,owner};
window.paBack=back;window.paOpen=open;window.paAdd=add;window.paSearch=search;window.paMore=more;window.paOwner=owner;
})();