(function(){
"use strict";
const API="https://api.tcgdex.net/v2/en/cards/";
const E=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const usd=n=>typeof n==="number"&&Number.isFinite(n)?"$"+n.toFixed(2):"Not available";
const matchID=id=>/^[a-zA-Z0-9._+-]+$/.test(id||"");
const cache=new Map();
const snapshots=new Map();
function productIDs(card){
 const values=[card.thirdParty?.tcgplayer,
   ...(card.variants_detailed||[]).map(variant=>variant.thirdParty?.tcgplayer),
   ...Object.values(card.pricing?.tcgplayer||{}).map(quote=>quote?.productId)];
 return [...new Set(values.filter(value=>Number.isSafeInteger(value)&&value>0))];
}
function priceFile(bucket){
 const previous=snapshots.get(bucket);
 if(previous && Date.now()-previous.at<900000)return previous.promise;
 const promise=fetch("./data/tcgplayer-prices/"+bucket+".json",{cache:"no-cache"})
  .then(response=>{if(!response.ok)throw Error("Price cache unavailable");return response.json()});
 snapshots.set(bucket,{at:Date.now(),promise});
 return promise;
}
async function supplement(card){
 const ids=productIDs(card);
 if(!ids.length)return card;
 try{
  const buckets=[...new Set(ids.map(id=>Math.floor(id/10000)))];
  const files=await Promise.all(buckets.map(priceFile));
  const entries={},ambiguous=new Set();
  let updated=null;
  for(const file of files){
   if(file.unit!=="USD" || !file.updated)return card;
   if(updated && updated!==file.updated)return card;
   updated=file.updated;
   for(const id of ids){
    for(const [finish,price] of Object.entries(file.products?.[id]||{})){
     if(!["normal","holofoil","reverse-holofoil"].includes(finish) || !Number.isFinite(price) || price<0)continue;
     if(entries[finish] && entries[finish].productId!==id)ambiguous.add(finish);
     entries[finish]={marketPrice:price,productId:id};
    }
   }
  }
  for(const finish of ambiguous)delete entries[finish];
  if(!Object.keys(entries).length)return card;
  const previous=card.pricing?.tcgplayer;
  const stamp=new Date(updated).getTime(),oldStamp=new Date(previous?.updated).getTime();
  if(!Number.isFinite(stamp) || stamp>Date.now()+300000)return card;
  if(previous && Object.values(previous).some(value=>Number.isFinite(value?.marketPrice)) && oldStamp>=stamp)return card;
  return {...card,pricing:{...card.pricing,tcgplayer:{unit:"USD",updated,provider:"TCGCSV",...entries}}};
 }catch{return card}
}
function makeLinks(card){
 const title=[card.name,card.set?.name,card.localId&&String(card.localId)].filter(Boolean).join(" ").trim();
 const searches=[
  ["TCGplayer — verify listings","https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q="+encodeURIComponent(title)],
  ["eBay — latest sold (raw)","https://www.ebay.com/sch/i.html?_nkw="+encodeURIComponent(title+" pokemon card")+"&LH_Sold=1&LH_Complete=1&_sop=13"],
  ["eBay — PSA 9 sold","https://www.ebay.com/sch/i.html?_nkw="+encodeURIComponent(title+" PSA 9")+"&LH_Sold=1&LH_Complete=1&_sop=13"],
  ["eBay — PSA 10 sold","https://www.ebay.com/sch/i.html?_nkw="+encodeURIComponent(title+" PSA 10")+"&LH_Sold=1&LH_Complete=1&_sop=13"],
  ["PriceCharting — compare grades","https://www.pricecharting.com/search-products?type=prices&q="+encodeURIComponent(title)]
 ];
 return searches.map(([label,url])=>'<a class="pm-source" href="'+E(url)+'" target="_blank" rel="noopener noreferrer">'+E(label)+' ↗</a>').join("");
}
function bestPrices(card){
 const quote=window.PokeGallery.sources(card);
 const rows=quote.variants.map(({variant,price,productId})=>{
   const link=Number.isSafeInteger(productId)&&productId>0
     ? '<a class="pm-source" target="_blank" rel="noopener noreferrer" href="https://www.tcgplayer.com/product/'+productId+'">Price Points ↗</a>' : "";
   return '<div class="pm-price"><span><b>'+E(variant.replaceAll("-"," "))+'</b><small>'+link+'</small></span><strong>'+usd(price)+'</strong></div>';
 }).join("");
 return '<p class="pm-muted">'+E(quote.title)+'. The feed identifies the finish. Check Price Points for your card’s condition.</p>'+
   (rows && quote.stale?'<p class="pm-warning">Historical snapshot · verify the current price.</p>':'')+
   (rows||'<p>Market Price unavailable for this card.</p>');
}
function render(card){
 const img=card.image?'<img src="'+E(card.image.replace(/\/(low|high)\.(png|webp)$/i,"")+"/low.webp")+'" alt="'+E(card.name)+'" class="pm-picture">':"";
 const artwork=card.illustrator?'<p class="pm-muted">Illustrator: '+E(card.illustrator)+'</p>':"";
 return '<div class="pm-cardhead">'+img+'<div><b>'+E(card.name)+'</b><p>'+E(card.set?.name||"Set unknown")+' · '+E(card.localId||"")+'</p><p>'+E(card.rarity||"Rarity unavailable")+'</p>'+artwork+'</div></div><h3>TCGplayer Market Price · USD</h3>'+bestPrices(card)+'<h3>Verify original sources</h3><div class="pm-links">'+makeLinks(card)+'</div><p class="pm-muted"><b>PSA 9 / PSA 10:</b> Prices are not automatically supplied by the raw TCGdex feed. Check the graded sold listings and confirm the exact card, grade, and variant.</p>';
}
function skeleton(name){return '<h2>Card market & sold listings</h2><p class="pm-muted">'+E(name||"Loading card")+'</p><div id="pm-body">Retrieving pricing and sources…</div><div class="modalFoot"><button class="btn" onclick="closeModal()">Close</button></div>'}
async function load(id){
 if(cache.has(id)&&Date.now()-cache.get(id).at<900000)return cache.get(id).data;
 const response=await fetch(API+encodeURIComponent(id),{headers:{Accept:"application/json"}});
 if(!response.ok)throw Error("Card lookup returned "+response.status);
 const data=await supplement(await response.json());cache.set(id,{at:Date.now(),data});return data;
}
async function open(id,fallback){
 if(!matchID(id)){show(skeleton(fallback||"Unknown card"));let el=document.getElementById("pm-body");if(el)el.textContent="No exact card database ID is available. Open the set in Explore Sets to find the correct variant.";return;}
 show(skeleton(fallback||id));
 try{const card=await load(id);const el=document.getElementById("pm-body");if(el)el.innerHTML=render(card);}
 catch(e){const el=document.getElementById("pm-body");if(el)el.textContent="Could not load market sources: "+e.message+". Check your connection and try again.";}
}
function openOwned(id){const c=getCard(id);if(!c)return;open(c.tcgdexId||(/^[a-z0-9]+(?:\.\d+)?-[\w-]+$/i.test(c.id)?c.id:""),c.name)}
const style='<style id="pm-style">.pm-cardhead{display:flex;gap:15px;align-items:flex-start;margin:14px 0}.pm-picture{width:92px;max-height:140px;object-fit:contain}.pm-cardhead b{font-size:19px}.pm-cardhead p{color:#61758f;font-size:12px;margin:5px 0}.pm-warning{font-size:12px;color:#80531c;background:#fff3d9;border:1px solid #e8d1a7;border-radius:9px;padding:10px}.pm-muted{font-size:12px;color:#667b97;margin:10px 0}.pm-price{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #ebf0f7;padding:10px 0}.pm-price span small{display:block;color:#8794a7}.pm-price strong{font-size:19px;color:#195fad}.pm-links{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:12px 0}.pm-source{border:1px solid #c6dcf6;background:#f0f7ff;padding:12px 8px;border-radius:11px;font-size:12px;color:#245fba;text-decoration:none;font-weight:750}.pm-source:hover{background:#dfeeff}@media(max-width:480px){.pm-links{grid-template-columns:1fr}}</style>';
document.head.insertAdjacentHTML("beforeend",style);
window.PokeMarket={open,openOwned,load,supplement,productIDs};
window.pmOpen=open;window.pmOpenOwned=openOwned;
})();