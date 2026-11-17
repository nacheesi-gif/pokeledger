(function(){
"use strict";
const API="https://api.tcgdex.net/v2/en/cards/";
const E=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const usd=n=>typeof n==="number"&&Number.isFinite(n)?"$"+n.toFixed(2):"Not available";
const matchID=id=>/^[a-zA-Z0-9._+-]+$/.test(id||"");
const cache=new Map();
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
 const t=card.pricing?.tcgplayer;
 if(!t)return "<div class='pm-muted'>TCGplayer quote unavailable from this feed. Use the marketplace links below to check current values.</div>";
 const variants=Object.entries(t).filter(([key,val])=>val&&typeof val==="object"&&typeof val.marketPrice==="number"&&Number.isFinite(val.marketPrice)&&!Array.isArray(val));
 const raw=t.updated,number=Number(raw),dateObj=raw?Number.isFinite(number)&&number>0?new Date(number*(number>1e11?1:1000)):new Date(raw):null;
 const validDate=dateObj&&Number.isFinite(dateObj.getTime()),date=validDate?dateObj.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"not provided";
 const stale=!validDate||(Date.now()-dateObj.getTime())>7*86400000;
 const lines=variants.map(([name,values])=>'<div class="pm-price"><span><b>'+E(name.replaceAll("-"," "))+'</b><small>'+(stale?"Historical / unverified quote":"Recent market snapshot")+'</small></span><strong>'+usd(values.marketPrice)+'</strong></div>').join("");
 return '<p class="pm-muted">TCGplayer via TCGdex · Quote date '+E(date)+' · currency '+E(t.unit||"USD")+'</p>'+(stale?'<p class="pm-warning">This feed is outdated or missing a reliable timestamp. Do not treat these values as current. Verify on TCGplayer or eBay before valuing your collection.</p>':'')+(lines||"<p>No market-price variants available. Verify directly using the links below.</p>")+'<p class="pm-muted">Snapshots are not independently verified completed sales. Review sold listings and confirm the card variant.</p>';
}
function render(card){
 const img=card.image?'<img src="'+E(card.image.replace(/\/(low|high)\.(png|webp)$/i,"")+"/low.webp")+'" alt="'+E(card.name)+'" class="pm-picture">':"";
 const artwork=card.illustrator?'<p class="pm-muted">Illustrator: '+E(card.illustrator)+'</p>':"";
 return '<div class="pm-cardhead">'+img+'<div><b>'+E(card.name)+'</b><p>'+E(card.set?.name||"Set unknown")+' · '+E(card.localId||"")+'</p><p>'+E(card.rarity||"Rarity unavailable")+'</p>'+artwork+'</div></div><h3>Raw / ungraded market prices</h3>'+bestPrices(card)+'<h3>Verify original sources</h3><div class="pm-links">'+makeLinks(card)+'</div><p class="pm-muted"><b>PSA 9 / PSA 10:</b> Prices are not automatically supplied by the raw TCGdex feed. Check the graded sold listings and confirm the exact card, grade, and variant.</p>';
}
function skeleton(name){return '<h2>Card market & sold listings</h2><p class="pm-muted">'+E(name||"Loading card")+'</p><div id="pm-body">Retrieving pricing and sources…</div><div class="modalFoot"><button class="btn" onclick="closeModal()">Close</button></div>'}
async function load(id){
 if(cache.has(id)&&Date.now()-cache.get(id).at<900000)return cache.get(id).data;
 const response=await fetch(API+encodeURIComponent(id),{headers:{Accept:"application/json"}});
 if(!response.ok)throw Error("Card lookup returned "+response.status);
 const data=await response.json();cache.set(id,{at:Date.now(),data});return data;
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
window.PokeMarket={open,openOwned,load};
window.pmOpen=open;window.pmOpenOwned=openOwned;
})();