(function(){
"use strict";
const E=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cache=new Map();
let observer=null,rootObserver=null,pool=0;const queue=[];
const valid=id=>/^[\w.+-]+$/.test(String(id||""));
function money(x){return "$"+Number(x).toFixed(2)}
function timestamp(value){
 if(value===null||value===undefined||value==="")return null;
 const n=Number(value),d=Number.isFinite(n)&&n>0?new Date(n*(n>1e11?1:1000)):new Date(value);
 return Number.isFinite(d.getTime())?d:null;
}
function ageDays(value){const d=timestamp(value);return d?Math.max(0,(Date.now()-d.getTime())/86400000):Infinity}
function sources(item){
 const t=item?.pricing?.tcgplayer||{};
 const last=timestamp(t.updated),stale=ageDays(t.updated)>7;
 const stamp=last?"as of "+last.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"date unavailable";
 const variants=Object.entries(t).filter(([key,v])=>v&&typeof v==="object"&&typeof v.marketPrice==="number"&&Number.isFinite(v.marketPrice)&&v.marketPrice>=0).map(([key,v])=>({variant:key,price:v.marketPrice}));
 if(!variants.length)return {label:"Check price ↗",title:"No usable TCGplayer quote in this feed. Tap to open marketplace verification links.",price:null,variant:null,stale:false};
 const min=Math.min(...variants.map(v=>v.price));
 const multiple=variants.length>1;
 const prefix=stale?"Old ":"";
 const label=prefix+(multiple?"From ":"")+money(multiple?min:variants[0].price);
 const title="TCGplayer via TCGdex · "+stamp+(stale?" · historical / may be stale":" · recent snapshot")+" · "+(multiple?"multiple finishes; check correct variant":variants[0].variant);
 return {label,title,price:!multiple&&!stale?variants[0].price:null,variant:multiple?"multiple":variants[0].variant,stale,updated:last?.toISOString()||null};
}
async function load(id){
 if(!valid(id))throw Error("Invalid card ID");
 if(cache.has(id))return cache.get(id);
 const promise=window.PokeMarket?.load?window.PokeMarket.load(id):fetch("https://api.tcgdex.net/v2/en/cards/"+encodeURIComponent(id)).then(r=>{if(!r.ok)throw Error("Price unavailable");return r.json()});
 cache.set(id,promise);
 promise.catch(()=>{if(cache.get(id)===promise)cache.delete(id)});
 if(cache.size>320)cache.delete(cache.keys().next().value);
 return promise;
}
function badge(id,owned){
 const st=owned&&typeof db!=="undefined"?db.statuses?.[owned]:null;
 if(st&&st.marketUnitValue!==null&&st.marketUnitValue!==undefined&&st.marketUnitValue!==""&&Number.isFinite(Number(st.marketUnitValue))){
   const when=st.marketAsOf||"date not provided";
   return '<span class="pk-price-badge pk-own-price" title="Your saved per-card market value · '+E(when)+' · verify condition and finish">'+money(st.marketUnitValue)+' <small>saved</small></span>';
 }
 if(!id||!valid(id))return '<span class="pk-price-badge pk-no-price">Price unlisted</span>';
 return '<button type="button" class="pk-price-badge pk-live-price" data-pkprice="'+E(id)+'" onclick="pmOpen(\''+E(id)+'\')" title="Check latest market prices and source links">Checking value…</button>';
}
async function apply(el,id){
 if(!el.isConnected||el.dataset.done)return;
 el.dataset.done="yes";
 try{
   const d=await load(id),quote=sources(d);
   if(!el.isConnected)return;
   el.textContent=quote.label;
   el.title=quote.title;
   if(quote.stale)el.classList.add("pk-old-price");
   else if(quote.price!==null||quote.variant==="multiple")el.classList.add("pk-has-price");
   else el.classList.add("pk-no-price");
 }catch{
   if(el.isConnected){el.textContent="Check price ↗";el.title="Market quote unavailable. Open direct marketplace links to verify.";el.classList.add("pk-no-price")}
 }
}
function drain(){if(document.hidden)return;const concurrency=navigator.connection?.saveData?1:3;while(pool<concurrency&&queue.length){const [el,id]=queue.shift();if(!el.isConnected)continue;pool++;apply(el,id).finally(()=>{pool--;drain()})}}
function enqueue(el){if(el.dataset.queued)return;el.dataset.queued="yes";queue.push([el,el.getAttribute("data-pkprice")]);drain()}
function observePrices(root){
 if(document.hidden)return;
 const host=document.getElementById("app");if(!host)return;
 const scope=root||host;
 const process=element=>{
   if(element.nodeType!==1)return;
   if(element.matches?.("[data-pkprice]:not([data-queued])")){
     if(observer)observer.observe(element);else enqueue(element);
   }
   element.querySelectorAll?.("[data-pkprice]:not([data-queued])").forEach(el=>{
     if(observer)observer.observe(el);else enqueue(el);
   });
 };
 process(scope);
}
function start(){
 const node=document.getElementById("app");if(!node)return;
 if("IntersectionObserver" in window){
   observer=new IntersectionObserver(entries=>{
     if(document.hidden)return;
     for(const entry of entries){if(entry.isIntersecting){observer.unobserve(entry.target);enqueue(entry.target)}}
   },{rootMargin:"200px"});
 }
 rootObserver=new MutationObserver(records=>{
   if(document.hidden)return;
   for(const record of records){
     for(const added of record.addedNodes){if(added.nodeType===1)observePrices(added)}
   }
 });
 rootObserver.observe(node,{childList:true,subtree:true});
 document.addEventListener("visibilitychange",()=>{if(!document.hidden){observePrices();drain()}});
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
 if(origin==="all")card=window.PokeAllCards?.card?.(id)||null;
 if(origin==="scanner")card=window.PokeScanner?.card?.(id)||null;
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
const css='<style id="pk-gallery-view">.pk-price-badge{display:inline-flex;align-items:center;gap:3px;border-radius:8px;font-size:11px;line-height:1.25;padding:6px 7px;background:#edf3fb;border:1px solid #d3e1f2;color:#486b91;font-weight:850;margin:4px 0}.pk-price-badge small{font-size:9px}.pk-has-price,.pk-own-price{background:#e6f5ea;border-color:#b4dac7;color:#117047}.pk-no-price{color:#62738b;background:#f2f4f8}.pk-old-price{color:#85611c;background:#fff2d9;border-color:#e6d2a8}.pk-live-price{cursor:pointer;font-family:inherit}.pk-card-tap{display:block;width:100%;border:0;background:none;cursor:zoom-in;padding:0;text-align:inherit}.pk-card-tap img{transition:transform .15s ease}.pk-card-tap:hover img{transform:scale(1.025)}.pk-zoom{position:fixed;inset:0;z-index:200;background:rgba(12,26,48,.92);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}.pk-zoom-dialog{max-width:900px;width:100%;background:#fff;border-radius:20px;padding:18px;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(220px,.7fr);gap:17px;position:relative;max-height:95vh;overflow:auto}.pk-zoom-close{position:absolute;right:12px;top:8px;border:none;background:#eaf1fb;border-radius:50%;font-size:25px;width:39px;height:39px;cursor:pointer;z-index:1}.pk-zoom-visual{display:flex;align-items:center;justify-content:center;min-width:0}.pk-zoom-image{width:auto;max-width:100%;max-height:84vh;object-fit:contain}.pk-zoom-info{align-self:center;padding:24px 4px}.pk-zoom-info h2{font-size:23px}.pk-zoom-info p,.pk-zoom-info small{color:#6d7d92;font-size:12px}.pk-zoom-info #pk-zoom-quote b{display:block;font-size:25px;color:#17663f;margin:14px 0 3px}.pk-zoom-info #pk-zoom-quote small{display:block}.pk-zoom-actions{display:flex;flex-wrap:wrap;gap:8px;margin:17px 0}@media(max-width:600px){.pk-zoom-dialog{grid-template-columns:1fr;padding:13px;gap:4px}.pk-zoom-image{max-height:64vh}.pk-zoom-info{padding:3px 10px}.pk-zoom-info h2{font-size:18px}.pk-zoom-info #pk-zoom-quote b{font-size:20px}}</style>';
document.head.insertAdjacentHTML("beforeend",css);
window.PokeGallery={badge,zoom,load,sources,observePrices,close};
window.pkZoom=zoom;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();