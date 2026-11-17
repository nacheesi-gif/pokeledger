(function(){
"use strict";
const E=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const SETS=[
 {id:"ascended",name:"Ascended Heroes",url:"https://www.restockr.app/pokemon-restocks/sets/ascended-heros"},
 {id:"prismatic",name:"Prismatic Evolutions",url:"https://www.restockr.app/pokemon-restocks/sets/prismatic-evolutions"},
 {id:"paldean",name:"Paldean Fates",url:"https://www.restockr.app/pokemon-restocks/sets/paldean-fates"},
 {id:"paldea",name:"Paldea Evolved",url:"https://www.restockr.app/pokemon-restocks/sets/paldea-evolved"},
 {id:"all",name:"Other Pokémon sets",url:"https://www.restockr.app/pokemon-restocks/sets"}
];
const RETAILERS=["Target","Walmart","Costco","Pokémon Center","Best Buy","Amazon","Sam's Club","GameStop"];
const SOURCES=[
 {name:"RestockR",detail:"Reported Pokémon restock history by store, product and set",url:"https://www.restockr.app/pokemon-restocks",id:"restockr"},
 {name:"PokeRestock",detail:"Recent publicly posted Pokémon restock alerts (delayed feed)",url:"https://pokerestockapp.com/restocks/",id:"pokerestock"},
 {name:"Restockd",detail:"Restock announcements and Pokémon product updates",url:"https://restockd.app/brands/pokemon",id:"restockd"},
 {name:"Los Angeles-area stores",detail:"Public shelf-restock history (reported with a delay; not current inventory)",url:"https://www.restockr.app/pokemon-restocks/in-store/los-angeles-ca",id:"local"}
];
function settings(){
 if(!db.restockWatch||typeof db.restockWatch!=="object")db.restockWatch={sets:["ascended","prismatic","paldean","paldea"],retailers:["Target","Walmart","Costco","Pokémon Center","Best Buy","Amazon"],custom:[],selected:"all"};
 const v=db.restockWatch;if(!Array.isArray(v.sets))v.sets=[];if(!Array.isArray(v.retailers))v.retailers=[];if(!Array.isArray(v.custom))v.custom=[];
 return v;
}
function listLink(url,name,subtitle,accent){
 return '<a href="'+E(url)+'" target="_blank" rel="noopener noreferrer" class="rw-link '+(accent?"rw-feature":"")+'"><strong>'+E(name)+'</strong><small>'+E(subtitle)+'</small><span>Open updates ↗</span></a>';
}
function render(){
 const p=settings();
 const watch=SETS.filter(s=>p.sets.includes(s.id)&&s.id!=="all");
 const extra=p.custom.slice(0,20);
 return '<section class="rw-head"><div><small class="rw-eyebrow">POKÉLEDGER • RESTOCK WATCH</small><h1>Restock Watch</h1><p>One place to check Pokémon restock reports, follow your priority sets and jump to the retailer. Free and local-first.</p></div><span class="rw-free">Free · no subscription</span></section>'+
 '<div class="rw-explain"><b>Report ≠ confirmed stock.</b> These are links to public restock reports, not a direct live inventory connection. Popular products can sell out within minutes. Local store reports may be delayed. Always confirm availability and price on the retailer’s page before traveling or purchasing.</div>'+
 '<div class="rw-heading"><h2>Check the latest reports</h2><small>Links open the original source so you can see its actual update time.</small></div>'+
 '<div class="rw-source-grid">'+SOURCES.map(s=>listLink(s.url,s.name,s.detail,s.id==="restockr")).join("")+'</div>'+
 '<div class="rw-heading"><h2>Your priority sets</h2><button type="button" class="btn sm" onclick="rwShowPreferences()">Edit watchlist</button></div>'+
 '<div class="rw-set-grid">'+(watch.length?watch.map(s=>'<article class="rw-watch"><div><strong>'+E(s.name)+'</strong><small>Restock history by set and retailer</small></div><div class="rw-watch-actions"><a href="'+E(s.url)+'" target="_blank" rel="noopener noreferrer" class="btn sm">Check reports ↗</a><button type="button" class="btn sm" onclick="rwToggleSet(\''+E(s.id)+'\')">Remove</button></div></article>').join(""):'<p class="rw-empty">No sets selected. Choose your watchlist below.</p>')+
 extra.map((name,i)=>'<article class="rw-watch"><div><strong>'+E(name)+'</strong><small>Custom product search</small></div><div class="rw-watch-actions"><a class="btn sm" href="https://www.google.com/search?q='+encodeURIComponent(name+" pokemon restock site:restockr.app OR site:restockd.app")+'" target="_blank" rel="noopener noreferrer">Find reports ↗</a><button type="button" class="btn sm" onclick="rwRemoveCustom('+i+')">Remove</button></div></article>').join("")+'</div>'+
 '<div class="rw-heading"><h2>Store shortcuts</h2><small>Your chosen retailers</small></div><div class="rw-stores">'+p.retailers.map(t=>'<a target="_blank" rel="noopener noreferrer" href="'+E("https://www.google.com/search?q="+encodeURIComponent(t+" Pokémon TCG restock site:restockr.app"))+'">'+E(t)+' ↗</a>').join("")+'</div>'+
 '<section id="rw-prefs" class="panel rw-prefs" hidden><div class="rw-heading"><h2>Manage your watchlist</h2><button type="button" class="btn sm" onclick="rwHidePreferences()">Close</button></div><h3>Set interests</h3><div class="rw-choice-grid">'+SETS.filter(s=>s.id!=="all").map(s=>'<label><input type="checkbox" '+(p.sets.includes(s.id)?"checked":"")+' onchange="rwToggleSet(\''+E(s.id)+'\')"> '+E(s.name)+'</label>').join("")+'</div><h3>Preferred stores</h3><div class="rw-choice-grid">'+RETAILERS.map(s=>'<label><input type="checkbox" '+(p.retailers.includes(s)?"checked":"")+' onchange="rwToggleStore(\''+E(s.replaceAll("'",""))+'\')"> '+E(s)+'</label>').join("")+'</div><form class="rw-custom" onsubmit="event.preventDefault();rwAddCustom(this)"><label>Add a specific product to track<input name="item" class="field" type="text" maxlength="80" required placeholder="e.g. Ascended Heroes ETB, 151 Booster Bundle"></label><button class="btn primary" type="submit">Add product</button></form></section>'+
 '<section class="rw-foot"><h3>How PokéLedger updates work</h3><p>This free tab keeps your watchlist and trusted public sources together. It does <b>not</b> automatically import third-party alerts or send background push notifications. Open a source to see newly reported drops; the source controls its own refresh and delay.</p><p>Watching a set here never creates a purchase or changes your collection balance.</p></section>';
}
function update(fn){fn(settings());save();return render}
function toggleSet(id){if(!SETS.some(x=>x.id===id))return;update(p=>{p.sets=p.sets.includes(id)?p.sets.filter(x=>x!==id):[...p.sets,id]})}
function toggleStore(id){if(!RETAILERS.includes(id))return;update(p=>{p.retailers=p.retailers.includes(id)?p.retailers.filter(x=>x!==id):[...p.retailers,id]})}
function addCustom(form){const name=String(form.elements.item.value||"").trim().slice(0,80);if(!name)return;update(p=>{if(p.custom.length>=20){alert("Up to 20 custom product searches can be saved.");return}if(!p.custom.some(x=>x.toLowerCase()===name.toLowerCase()))p.custom.push(name)});form.reset();const outer=document.getElementById("rw-prefs");if(outer)outer.hidden=false}
function removeCustom(i){if(!Number.isInteger(i)||i<0)return;update(p=>{p.custom.splice(i,1)})}
function redraw(keepPreferences){
 const node=document.getElementById("app");if(!node)return;
 const open=keepPreferences??(document.getElementById("rw-prefs")?.hidden===false);
 node.innerHTML=renderNav()+render()+'<div class="foot">PokéLedger · Restock sources are external and may be delayed</div>';
 if(open){const p=document.getElementById("rw-prefs");if(p)p.hidden=false}
}
function showPrefs(){const p=document.getElementById("rw-prefs");if(p){p.hidden=false;p.scrollIntoView({behavior:"smooth",block:"start"})}}
function hidePrefs(){const p=document.getElementById("rw-prefs");if(p)p.hidden=true}
function changeSet(id){toggleSet(id);redraw(true)}
function changeStore(id){toggleStore(id);redraw(true)}
function changeCustom(form){const name=String(form.elements.item.value||"").trim().slice(0,80);if(!name)return;const p=settings();if(p.custom.length>=20){alert("Maximum 20 custom product searches.");return}if(!p.custom.some(x=>x.toLowerCase()===name.toLowerCase())){p.custom.push(name);save()}redraw(true)}
function delCustom(i){const p=settings();if(i>=0&&i<p.custom.length){p.custom.splice(i,1);save();redraw(false)}}
const css='<style id="rw-css">.rw-head{padding:20px;background:linear-gradient(135deg,#eaf4ff,#fff);border:1px solid #d1e3fa;border-radius:18px;margin:13px 0;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}.rw-head h1{font-size:26px}.rw-head p{color:#63768e;font-size:13px;max-width:650px;margin-top:5px}.rw-eyebrow{font-size:10px;font-weight:900;letter-spacing:1px;color:#245cb5}.rw-free{font-size:11px;color:#1a704f;background:#e5f6eb;border:1px solid #badbca;border-radius:12px;padding:8px 10px;font-weight:800}.rw-explain{padding:13px 16px;background:#fff7ea;border:1px solid #f0dab5;border-radius:12px;color:#76551c;font-size:12px;margin:14px 0}.rw-heading{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin:18px 0 11px}.rw-heading small{font-size:11px;color:#6b7d94}.rw-source-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.rw-link{display:block;text-decoration:none;border:1px solid #d7e3f4;background:#fff;border-radius:13px;padding:13px;color:#203755}.rw-link strong,.rw-link small{display:block}.rw-link small{color:#697e96;font-size:11px;margin:5px 0 9px}.rw-link span{color:#2566af;font-weight:800;font-size:11px}.rw-feature{border-color:#98c3f3;background:#f1f8ff}.rw-set-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.rw-watch{border:1px solid #d7e4f3;background:white;padding:13px;border-radius:12px;display:flex;flex-direction:column;justify-content:space-between;gap:12px}.rw-watch strong{font-size:14px}.rw-watch small{display:block;color:#76859b;font-size:11px;margin-top:5px}.rw-watch-actions{display:flex;flex-wrap:wrap;gap:7px}.rw-stores{display:flex;gap:7px;flex-wrap:wrap}.rw-stores a{padding:9px;border:1px solid #cddff5;background:#f2f7fe;border-radius:10px;text-decoration:none;color:#2c63a3;font-size:12px;font-weight:800}.rw-prefs{margin-top:15px}.rw-prefs h3{margin:15px 0 9px}.rw-choice-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.rw-choice-grid label{font-size:12px}.rw-choice-grid input{accent-color:#2b6fcb}.rw-custom{display:flex;align-items:end;gap:9px;margin-top:15px}.rw-custom label{flex:1;font-size:12px}.rw-custom .field{width:100%;margin-top:5px}.rw-foot{padding:15px;background:#eef3f9;border-radius:14px;margin:20px 0;font-size:12px;color:#526983}.rw-foot p{margin:9px 0}.rw-empty{color:#687b90;font-size:12px}@media(max-width:550px){.rw-source-grid,.rw-set-grid,.rw-choice-grid{grid-template-columns:1fr}.rw-custom{align-items:stretch;flex-direction:column}}</style>';
document.head.insertAdjacentHTML("beforeend",css);
window.PokeRestocks={render,settings,changeSet,changeStore,changeCustom,delCustom};
window.rwShowPreferences=showPrefs;window.rwHidePreferences=hidePrefs;window.rwToggleSet=changeSet;window.rwToggleStore=changeStore;window.rwAddCustom=changeCustom;window.rwRemoveCustom=delCustom;
})();