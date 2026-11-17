(function(){
"use strict";
const E=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cache=new Map(),work=new Set();
let observer=null,rootObserver=null,pool=0;const queue=[];
const valid=id=>/^[\w.+-]+$/.test(String(id||""));
function money(x){return "$"+Number(x).toFixed(2)}
function sources(item){
 const t=item?.pricing?.tcgplayer||{};
 const variants=Object.entries(t).filter(([key,v])=>v&&typeof v==="object"&&typeof v.marketPrice==="number"&&Number.isFinite(v.marketPrice)&&v.marketPrice>=0).map(([key,v])=>({variant:key,price:v.marketPrice}));
 if(!variants.length)return {label:"Price N/A",title:"No TCGplayer raw market snapshot for this printing.",price:null,variant:null};
 if(variants.length===1)return {label:money(variants[0].price),title:"Raw TCGplayer market snapshot · "+variants[0].variant+" · verify exact finish",price:variants[0].price,variant:variants[0].variant};
 const min=Math.min(...variants.map(v=>v.price));
 return {label:"From "+money(min),title:"Raw TCGplayer market estimates vary by finish. Lowest listed variant; open details to choose the correct one.",price:null,variant:"multiple"};
}
async function load(id){
 if(!valid(id))throw Error("Invalid card ID");
 if(cache.has(id))return cache.get(id);
 const promise=window.PokeMarket?.load?window.PokeMarket.load(id):fetch("https://api.tcgdex.net/v2/en/cards/"+encodeURIComponent(id)).then(r=>{if(!r.ok)throw Error("Price unavailable");return r.json()});
 cache.set(id,promise);
 return promise;
}
function badge(id,owned){
 const st=owned&&typeof db!=="undefined"?db.statuses?.[owned]:null;
 if(st&&st.marketUnitValue!==null&&st.marketUnitValue!==undefined&&st.marketUnitValue!==""&&Number.isFinite(Number(st.marketUnitValue)))return '<span class="pk-price-badge pk-own-price" title="Your saved per-card market value · verify date and finish">'+money(st.marketUnitValue)+' <small>saved</small></span>';
 if(!id||!valid(id))return '<span class="pk-price-badge pk-no-price">Value N/A</span>';
 return '<span class="pk-price-badge pk-live-price" data-pkprice="'+E(id)+'" title="Market value fetching">Checking value…</span>';
}
async function apply(el,id){
 if(!el.isConnected||el.dataset.done)return;
 el.dataset.done="yes";
 try{const d=await load(id),quote=sources(d);if(!el.isConnected)return;
 el.textContent=quote.label;
 el.title=quote.title;
 if(quote.price!==null){el.classList.add("pk-has-price");}
 else if(quote.variant==="multiple")el.classList.add("pk-has-price");
 else el.classList.add("pk-no-price");
 }catch{if(el.isConnected){el.textContent="Value N/A";el.title="Live raw pricing could not be retrieved";el.classList.add("pk-no-price")}}
}
function drain(){while(pool<4&&queue.length){const [el,id]=queue.shift();if(!el.isConnected)continue;pool++;apply(el,id).finally(()=>{pool--;drain()})}}
function enqueue(el){if(el.dataset.queued)return;el.dataset.queued="yes";queue.push([el,el.getAttribute("data-pkprice")]);drain()}
function observePrices(){
 const holder=document.getElementById("app");if(!holder)return;
 if(observer)observer.disconnect();
 if("IntersectionObserver" in window){
 observer=new IntersectionObserver(entries=>{entries.forEach(x=>{if(x.isIntersecting){enqueue(x.target);observer.unobserve(x.target)}})},{rootMargin:"350px"});
 holder.querySelectorAll("[data-pkprice]:not([data-queued])").forEach(el=>observer.observe(el));
 }else holder.querySelectorAll("[data-pkprice]:not([data-queued])").forEach(enqueue);
}
function start(){
 const node=document.getElementById("app");if(!node)return;
 let scheduled=false;
 rootObserver=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;observePrices()})});
 rootObserver.observe(node,{childList:true,subtree:true});
 observePrices();
}
const hi=image=>{
 if(!image)return "";
 if(/^https:\/\/assets\.tcgdex\.net\//.test(image))return image.replace(/\/(low|high)\.(png|webp)$/i,"")+"/high.webp";
 if(/^https:\/\/images\.pokemontcg\.io\//.test(image))return image.replace(/\/(low|high)\.(png|webp)$/i,".png");
 return image;
};
function close(){document.getElementById("pk-zoom")?.remove();document.removeEventListener("keydown",closeKey)}
function closeKey(e){if(e.key==="Escape")close()}
async function zoom(id,origin){
 close();
 let card=null;
 if(origin==="binder")card=typeof getCard==="function"?getCard(id):null;
 if(origin==="explore")card=window.pxCard?.(id)||null;
 if(!card)return;
 const name=E(card.name),idForPrices=card.tcgdexId||card.id;
 let art=hi(card.image||""),rawid=valid(idForPrices)?idForPrices:"";
 const holder=document.createElement("div");holder.id="pk-zoom";holder.className="pk-zoom";
 holder.innerHTML='<div class="pk-zoom-dialog" role="dialog" aria-modal="true" aria-label="Large card view"><button class="pk-zoom-close" type="button" aria-label="Close enlarged card">×</button><div class="pk-zoom-visual">'+(art?'<img class="pk-zoom-image" src="'+E(art)+'" alt="'+name+' enlarged" onerror="this.alt=\'Enlarged card image unavailable\'">':'<div class="pk-no-zoom">Card image unavailable</div>')+'</div><div class="pk-zoom-info"><h2>'+name+'</h2><p>'+E(card.set?.name||card.set||"")+' · '+E(card.number||card.localId||"")+'</p><div id="pk-zoom-quote">Checking market value…</div><div class="pk-zoom-actions">'+(rawid?'<button class="btn primary sm" type="button" id="pk-zoom-details">Market details & source links</button>':'')+'<button class="btn sm" type="button" id="pk-zoom-dismiss">Close</button></div><small>Market prices are indicative, not sale proceeds. Select the correct printing and finish.</small></div></div>';
 holder.addEventListener("click",e=>{if(e.target===holder)close()});
 document.body.append(holder);
 holder.querySelector(".pk-zoom-close")?.addEventListener("click",close);
 holder.querySelector("#pk-zoom-dismiss")?.addEventListener("click",close);
 holder.querySelector("#pk-zoom-details")?.addEventListener("click",()=>{close();window.pmOpen(rawid)});
 document.addEventListener("keydown",closeKey);
 if(rawid){try{const obj=await load(rawid),info=sources(obj);let label=holder.querySelector("#pk-zoom-quote");if(label)label.innerHTML='<b>'+E(info.label)+'</b><small>'+E(info.title)+'</small>'}catch{const el=holder.querySelector("#pk-zoom-quote");if(el)el.textContent="Market value unavailable"}}
 else holder.querySelector("#pk-zoom-quote").textContent="Market value unavailable";
}
const css='<style id="pk-gallery-view">.pk-price-badge{display:inline-flex;align-items:center;gap:3px;border-radius:8px;font-size:11px;line-height:1.25;padding:6px 7px;background:#edf3fb;border:1px solid #d3e1f2;color:#486b91;font-weight:850;margin:4px 0}.pk-price-badge small{font-size:9px}.pk-has-price,.pk-own-price{background:#e6f5ea;border-color:#b4dac7;color:#117047}.pk-no-price{color:#62738b;background:#f2f4f8}.pk-card-tap{display:block;width:100%;border:0;background:none;cursor:zoom-in;padding:0;text-align:inherit}.pk-card-tap img{transition:transform .15s ease}.pk-card-tap:hover img{transform:scale(1.025)}.pk-zoom{position:fixed;inset:0;z-index:200;background:rgba(12,26,48,.92);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}.pk-zoom-dialog{max-width:900px;width:100%;background:#fff;border-radius:20px;padding:18px;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(220px,.7fr);gap:17px;position:relative;max-height:95vh;overflow:auto}.pk-zoom-close{position:absolute;right:12px;top:8px;border:none;background:#eaf1fb;border-radius:50%;font-size:25px;width:39px;height:39px;cursor:pointer;z-index:1}.pk-zoom-visual{display:flex;align-items:center;justify-content:center;min-width:0}.pk-zoom-image{width:auto;max-width:100%;max-height:84vh;object-fit:contain}.pk-zoom-info{align-self:center;padding:24px 4px}.pk-zoom-info h2{font-size:23px}.pk-zoom-info p,.pk-zoom-info small{color:#6d7d92;font-size:12px}.pk-zoom-info #pk-zoom-quote b{display:block;font-size:25px;color:#17663f;margin:14px 0 3px}.pk-zoom-info #pk-zoom-quote small{display:block}.pk-zoom-actions{display:flex;flex-wrap:wrap;gap:8px;margin:17px 0}@media(max-width:600px){.pk-zoom-dialog{grid-template-columns:1fr;padding:13px;gap:4px}.pk-zoom-image{max-height:64vh}.pk-zoom-info{padding:3px 10px}.pk-zoom-info h2{font-size:18px}.pk-zoom-info #pk-zoom-quote b{font-size:20px}}</style>';
document.head.insertAdjacentHTML("beforeend",css);
window.PokeGallery={badge,zoom,load,sources,observePrices,close};
window.pkZoom=zoom;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();