(function pokeLedgerExplorer(){
 "use strict";
 const API="https://api.tcgdex.net/v2/en";
 const KEY="pokeledger-explore-cache-v1";
 const groups=[
 ["all","All sets","📚"],["tg","Trainer Galleries","🖼️"],["gg","Galarian Gallery","🌟"],["promo","Black Star Promos","🎟️"],["arts","IRs & SIRs","🎨"],["sv","Scarlet & Violet","🔴"],["swsh","Sword & Shield","🔵"],["vintage","Vintage","📼"],["komiya","Tomokazu Komiya","🎨"],["kanda","Shinji Kanda","🎨"]
 ];
 const x={sets:null,loading:false,error:"",group:"all",query:"",set:null,cards:[],working:false,setError:"",token:0,details:{},progress:0,running:false,search:"",rarity:"all",sort:"rarity",limit:48,setLimit:36,owner:"Me",combinedSets:[],combinedNext:0,combinedBusy:false,combinedFailures:0};
 const esc=t=>String(t??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 const token=t=>String(t||"").replace(/[^a-zA-Z0-9._+-]/g,"");
 const number=t=>(String(t||"").match(/\d+/)||["0"])[0];
 const normalizeCollector=t=>String(t||"").toUpperCase().replace(/\s+/g,"").replace(/([A-Z]+)0+(?=\d)/g,"$1").replace(/[^A-Z0-9/]/g,"");
 const matchesCollector=(card,query)=>{const q=normalizeCollector(query),id=normalizeCollector(card.localId);return Boolean(q&&(id.includes(q)||normalizeCollector(sourceNum(card,x.set)).includes(q))) };
 const isTG=s=>/trainer gallery/i.test(s?.name||"")||/swsh(9|10|11|12)(\.5)?tg/.test(s?.id||"");
 const isGG=s=>/galarian gallery/i.test(s?.name||"")||/swsh12(\.5)?gg/.test(s?.id||"");
 const isPromo=s=>/promo/i.test(s?.name||"");
 const date=s=>s?.releaseDate||"";
 const era=s=>(String(s?.serie?.name||"")+" "+String(s?.name||"")).toLowerCase();
 const isOwned=c=>!!(c&&db.statuses?.[c.id]&&["Owned","Grading"].includes(db.statuses[c.id].state));
 const n=t=>Number(t||0).toLocaleString("en-US");
 const sourceNum=(c,s)=>{
   if(s?.combinedGroup||s?.combinedTG)s=c._set||s;
   if(s?.artistName)return String(c.localId||"?")+(c.set?.cardCount?.official?"/"+c.set.cardCount.official:"");
   const suffix=isTG(s)?"TG30":isGG(s)?"GG70":s?.cardCount?.official||s?.cardCount?.total||"";
   return String(c.localId||"?")+(suffix?"/"+suffix:"");
 };
 function cache(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch{return {}}}
 function store(obj){try{let a={...cache(),...obj};if(a.details){a.details=Object.fromEntries(Object.entries(a.details).sort((p,q)=>(q[1]?.at||0)-(p[1]?.at||0)).slice(0,8))}localStorage.setItem(KEY,JSON.stringify(a))}catch{}}
 async function fetchJSON(path){const r=await fetch(API+path,{headers:{Accept:"application/json"}});if(!r.ok)throw Error("Database error "+r.status);return r.json()}
 function groupMatch(s){
   if(x.group==="all")return true;
   if(x.group==="tg")return isTG(s);
   if(x.group==="gg")return isGG(s);
   if(x.group==="promo")return isPromo(s);
   if(x.group==="arts")return (/scarlet|violet|mega|sword|shield/i.test(era(s))||date(s)>="2023-01-01")&&!isTG(s)&&!isPromo(s)&&!isGG(s);
   if(x.group==="sv")return /scarlet|violet|mega evolution/i.test(era(s))||(date(s)>="2023-01-01"&&!isPromo(s)&&!isTG(s)&&!isGG(s));
   if(x.group==="swsh")return /sword|shield/i.test(era(s));
   if(x.group==="vintage")return /^(199\d|200\d)/.test(date(s))||/base|jungle|fossil|neo|gym|e-card/i.test(era(s));
   return true;
 }
 function filteredSets(){let a=(x.sets||[]).filter(groupMatch);if(x.query.trim()){const q=x.query.toLowerCase().trim();a=a.filter(s=>(s.name+" "+s.id+" "+(s.serie?.name||"")).toLowerCase().includes(q))}return a.sort((a,b)=>date(b).localeCompare(date(a))||a.name.localeCompare(b.name))}
 function logo(s){return s?.logo?s.logo.replace(/\/(low|high)\.(webp|png)$/i,"")+"/low.webp":""}
 function setEntry(s){
   const img=logo(s)?`<img class="px-setlogo" loading="lazy" src="${esc(logo(s))}" alt="" onerror="this.style.display='none'">`:`<div class="px-emoji">${isTG(s)?"🖼️":isGG(s)?"🌟":isPromo(s)?"🎟️":"🃏"}</div>`;
   const count=s.cardCount?.total||s.cardCount?.official||"";
   return `<button class="px-set" onclick="pxOpen('${token(s.id)}')">${img}<strong>${esc(s.name)}</strong><small>${esc(s.releaseDate||"")} ${count?"· "+n(count)+" cards":""}</small></button>`;
 }
 function setsPanel(){
   if(x.group==="komiya"||x.group==="kanda"){const k=x.group,who=k==="komiya"?"Tomokazu Komiya":"Shinji Kanda";return '<header class="px-head"><div><span class="px-kicker">ILLUSTRATOR COLLECTION</span><h1>'+esc(who)+'</h1><p>Browse cards credited to this artist across multiple sets. Add only the ones you own.</p></div></header><div class="px-tabs">'+groups.map(([id,name,emoji])=>'<button class="px-chip '+(x.group===id?"active":"")+'" onclick="pxGroup(\''+id+'\')">'+emoji+' '+name+'</button>').join("")+'</div><div class="px-setgrid"><button class="px-set" onclick="pxArtist(\''+k+'\')"><div class="px-emoji">🎨</div><strong>'+esc(who)+'</strong><small>View artist card catalog</small></button></div><div class="px-note">Illustrator credits from TCGdex. English card catalog; Japanese-exclusive printings may not be included.</div>'}
   if(!x.sets&&x.loading)return '<div class="px-empty">Loading Pokémon sets…</div>';
   if(!x.sets)return `<div class="px-empty">Could not reach the card database. ${esc(x.error)} <button class="btn sm" onclick="pxLoad()">Retry</button></div>`;
   const a=filteredSets(),shown=a.slice(0,x.setLimit),groupName=groups.find(g=>g[0]===x.group)?.[1]||"Cards",canCombine=x.group!=="all"&&a.length>1;
   return `<header class="px-head"><div><span class="px-kicker">POKÉDEX • DISCOVERY</span><h1>Explore Sets</h1><p>Pick any collection, see the full card checklist, and add only the cards you own.</p></div><span class="pill blue">${n(x.sets.length)} sets</span></header>
   ${canCombine?`<div class="px-viewall-banner"><div><b>All ${esc(groupName)} cards</b><small>See cards from every subset together, or select a subset below.</small></div><button class="btn primary" onclick="pxAllGroup()">View All ${esc(groupName)} Cards</button></div>`:x.group==="all"?`<div class="px-viewall-banner"><div><b>All cards, one gallery</b><small>Browse every expansion and promo together, or keep browsing by collection below.</small></div><button class="btn primary" onclick="paOpen()">View All Cards</button></div>`:""}<div class="px-tabs">${groups.map(([id,name,emoji])=>`<button class="px-chip ${x.group===id?"active":""}" onclick="pxGroup('${id}')">${emoji} ${name}</button>`).join("")}</div>
   <div class="px-controls"><input id="px-setsearch" class="field" type="search" placeholder="Search expansions, galleries, promos…" aria-label="Search sets" value="${esc(x.query)}" oninput="pxSearchSets(this.value)"><span id="px-total">${a.length} collections</span></div>
   <div id="px-setresults">${shown.length?`<div class="px-setgrid">${shown.map(setEntry).join("")}</div>`:"<div class='empty'>No matching sets.</div>"}${shown.length<a.length?`<button class="btn px-more" onclick="pxMoreSets()">Show more sets · ${n(a.length-shown.length)} remaining</button>`:""}</div>
   <div class="px-note">Public set data and card images from TCGdex. Browsing doesn't affect your collection or spending.</div>`;
 }
 function rank(raw){
   const r=String(raw||"").toLowerCase();
   if(!r||r==="rarity loading"||r==="rarity unavailable")return -1;
   if(/mega hyper|crown/.test(r))return 120;
   if(/special illustration/.test(r))return 115;
   if(/hyper|secret/.test(r))return 110;
   if(/illustration/.test(r))return 100;
   if(/ultra|full art/.test(r))return 90;
   if(/rainbow/.test(r))return 88;
   if(/double rare|ace spec/.test(r))return 82;
   if(/trainer gallery/.test(r))return 80;
   if(/holo/.test(r))return 72;
   if(/rare/.test(r))return 60;
   if(/uncommon/.test(r))return 25;
   if(/common/.test(r))return 10;
   return 40;
 }
 function rarity(c){return x.details[c.id]?.rarity||c.rarity||(isTG(x.set)?"Trainer Gallery · rarity loading":isGG(x.set)?"Galarian Gallery · rarity loading":"Rarity loading")}
 function filteredCards(){
   let a=x.cards;
   if(x.search.trim()){const q=x.search.toLowerCase().trim();a=a.filter(c=>(c.name+" "+rarity(c)).toLowerCase().includes(q)||matchesCollector(c,q))}
   if(x.rarity!=="all")a=a.filter(c=>{
     const r=rarity(c).toLowerCase();
     if(x.rarity==="sir")return r.includes("special illustration");
     if(x.rarity==="ir")return r.includes("illustration")&&!r.includes("special");
     if(x.rarity==="rare")return rank(r)>=60;
     if(x.rarity==="common")return r.includes("common")&&!r.includes("uncommon");
     return true;
   });
   return [...a].sort((a,b)=>x.sort==="name"?a.name.localeCompare(b.name):x.sort==="number"?Number(number(a.localId))-Number(number(b.localId)):rank(rarity(b))-rank(rarity(a))||Number(number(b.localId))-Number(number(a.localId)));
 }
 function findOwned(c){
   const existing=allCards();
   const actualSet=x.set.combinedGroup?c._set:x.set;
   const fullname=actualSet.name.replace(/ Trainer Gallery$/i,"").replace(/ Galarian Gallery$/i,"");
   return existing.find(v=>v.tcgdexId===c.id||v.id==="ex-"+c.id)||
     existing.find(v=>v.name.toLowerCase()===c.name.toLowerCase()&&String(v.number).split("/")[0].toUpperCase()===String(c.localId).toUpperCase()&&(v.set===actualSet.name||v.set===fullname));
 }
 function alternativeScan(c){
   const name=(x.set?.combinedGroup?c._set?.name:x.set?.name)||"";
   const sub=name.includes("Brilliant Stars")?"swsh9tg":name.includes("Astral Radiance")?"swsh10tg":name.includes("Lost Origin")?"swsh11tg":name.includes("Silver Tempest")?"swsh12tg":isGG(x.set)?"swsh12pt5gg":"";
   return sub?"https://images.pokemontcg.io/"+sub+"/"+encodeURIComponent(c.localId)+".png":"";
 }
 function scan(c){
   const fallback=alternativeScan(c);
   const url=c.image?c.image.replace(/\/(low|high)\.(png|webp)$/i,"")+"/low.webp":"";
   const primary=(isTG(x.set?.combinedGroup?c._set:x.set)||isGG(x.set?.combinedGroup?c._set:x.set))&&fallback?fallback:url||fallback;
   const secondary=primary!==fallback?fallback:url;
   if(!primary)return '<div class="px-noimage">Card scan<br>unavailable</div>';
   const error=secondary&&secondary!==primary?`this.onerror=function(){this.onerror=null;this.outerHTML='<div class=&quot;px-noimage&quot;>Card scan unavailable</div>'};this.src='${esc(secondary)}'`:"this.onerror=null;this.outerHTML='<div class=&quot;px-noimage&quot;>Card scan unavailable</div>'";
   return `<img loading="lazy" class="px-art" src="${esc(primary)}" alt="${esc(c.name)}" onerror="${error}">`;
 }
 function cardsPanel(){
   const all=filteredCards(),show=all.slice(0,x.limit);
   return `<div class="px-status">${n(all.length)} of ${n(x.cards.length)} cards · ${x.sort==="rarity"?"Rarest first":"Set checklist"} <span>${x.running?"Loading rarity details "+x.progress+"/"+x.cards.length:""}</span></div>
   ${show.length?`<div class="px-cardgrid">${show.map(c=>{
      const tracked=findOwned(c),owned=isOwned(tracked),qty=owned?Math.max(1,Number(db.statuses[tracked.id]?.qty)||0):0;
      return `<article class="px-card"><div class="px-artbox"><button class="pk-card-tap" type="button" onclick="pkZoom(\'${token(c.id)}\',\'explore\')" aria-label="Enlarge ${esc(c.name)}">${scan(c)}</button>${owned?'<span class="px-owned">✓ OWNED</span>':""}</div><div class="px-cardinfo"><strong>${esc(c.name)}</strong>${x.set?.combinedGroup?`<small>${esc(c._set?.name||"Subset")}</small>`:""}<small>${esc(sourceNum(c,x.set))}</small><small>${esc(rarity(c))}</small>${window.PokeGallery.badge(token(c.id),tracked?.id)}<button class="px-add ${owned?"yes":""}" onclick="pxAdd('${token(c.id)}')">${owned?"✓ Owned · Add another":"+ Add to My Binder"}</button><button class="px-add px-market" onclick="pmOpen(\'${token(c.id)}\')">Market / sold links ↗</button>${owned?`<small>Quantity: ${qty}</small>`:""}</div></article>`;
   }).join("")}</div>`:"<div class='empty'>No cards match those filters. Rarity details may still be loading.</div>"}
   ${show.length<all.length?`<button class="btn px-more" onclick="pxMoreCards()">Show more cards · ${n(all.length-show.length)} remaining</button>`:""}${x.set?.combinedGroup?(x.combinedNext<x.combinedSets.length?`<button class="btn px-more" onclick="pxLoadMoreGroup()" ${x.combinedBusy?"disabled":""}>${x.combinedBusy?"Loading subsets…":`Load more subsets · ${x.combinedSets.length-x.combinedNext} remaining`}</button>`:x.combinedFailures?`<p class="px-note">${x.combinedFailures} subset${x.combinedFailures===1?"":"s"} could not be loaded.</p>`:""):""}`;
 }
 function selectedPanel(){
   if(x.working)return '<div class="px-empty">Loading this set checklist…</div>';
   if(x.setError)return `<button class="btn sm" onclick="pxBack()">← All sets</button><div class="px-empty">${esc(x.setError)} <button class="btn sm" onclick="${x.set?.combinedGroup?"pxRetryGroup()":`pxOpen(\'${token(x.set.id)}\')`}">Retry</button></div>`;
   const owned=x.cards.filter(c=>isOwned(findOwned(c))).length,all=x.cards.length;
   const emblem=logo(x.set)?`<img class="px-selectedlogo" src="${esc(logo(x.set))}" alt="">`:"";
   return `<button class="btn sm" onclick="pxBack()">← Back to ${x.set?.combinedGroup?"category subsets":"sets"}</button><header class="px-head px-selected">${emblem}<div><span class="px-kicker">${x.set?.combinedGroup?`COMBINED GALLERY · ${x.combinedNext} OF ${x.combinedSets.length} SUBSETS LOADED`:`${esc(x.set.releaseDate||"")} · SET CHECKLIST`}</span><h1>${esc(x.set.name)}</h1><p>${n(all)} cards loaded · ${owned} owned · ${all?Math.round(owned/all*100):0}% collected${x.set?.combinedGroup&&x.combinedNext<x.combinedSets.length?" · More subsets available":""}</p><div class="px-progress"><div style="width:${all?owned/all*100:0}%"></div></div></div></header>
   <div class="px-controls px-cardcontrols"><input type="search" class="field" placeholder="Search card name or number…" value="${esc(x.search)}" oninput="pxSearchCards(this.value)">
   <select class="field" onchange="pxRarity(this.value)"><option value="all">All rarities</option><option value="sir" ${x.rarity==="sir"?"selected":""}>SIR</option><option value="ir" ${x.rarity==="ir"?"selected":""}>IR</option><option value="rare" ${x.rarity==="rare"?"selected":""}>Rare or higher</option><option value="common" ${x.rarity==="common"?"selected":""}>Common</option></select>
   <select class="field" onchange="pxSort(this.value)"><option value="rarity" ${x.sort==="rarity"?"selected":""}>Rarest first</option><option value="number" ${x.sort==="number"?"selected":""}>Number</option><option value="name" ${x.sort==="name"?"selected":""}>Name</option></select>
   <select class="field" aria-label="Add cards for family member" onchange="pxOwner(this.value)">${db.members.map(m=>`<option value="${esc(m)}" ${x.owner===m?"selected":""}>For ${esc(m)}</option>`).join("")}</select></div>
   <div id="px-cardresults">${cardsPanel()}</div>
   <div class="px-note">${x.set?.combinedGroup?"Combined view shows all cards in the loaded subsets. Use Load more subsets for additional cards; rarity details are progressively populated. ":""}Card rarities load progressively; until then, sort order is provisional. Some subset scans are missing from public databases. Saved cards are local to your device.</div>`;
 }
 function repaint(){if(window.PokeAllCards?.active)return;if(typeof page!=="undefined"&&page!=="explore")return;const node=document.getElementById("px-main");if(node)node.innerHTML=x.set?selectedPanel():setsPanel()}
 function repaintCards(){if(typeof page!=="undefined"&&page!=="explore")return;const node=document.getElementById("px-cardresults");if(node&&x.set&&!x.working)node.innerHTML=cardsPanel()}
 async function loadSets(){
   if(x.loading)return;
   const old=cache();
   if(!x.sets&&Array.isArray(old.sets)&&old.sets.length){x.sets=old.sets;repaint()}
   if(x.sets&&Date.now()-Number(old.at||0)<86400000)return;
   x.loading=true;repaint();
   try{const sets=await fetchJSON("/sets");if(!Array.isArray(sets)||sets.length<1)throw Error("No sets returned");x.sets=sets;store({sets,at:Date.now()});x.error=""}
   catch(e){x.error="Check your internet connection. "+e.message}
   x.loading=false;repaint()
 }
 function selectGroup(group){x.combinedBusy=false;x.group=group;x.setLimit=36;x.set=null;x.cards=[];x.token++;repaint()}
 function searchSets(q){
   x.query=q;x.setLimit=36;const results=document.getElementById("px-setresults");
   if(results){const a=filteredSets(),show=a.slice(0,x.setLimit);results.innerHTML=show.length?`<div class="px-setgrid">${show.map(setEntry).join("")}</div>${show.length<a.length?`<button class="btn px-more" onclick="pxMoreSets()">Show more sets</button>`:""}`:"<div class='empty'>No matching sets.</div>";const label=document.getElementById("px-total");if(label)label.textContent=a.length+" collections"}
 }
 function moreSets(){x.setLimit+=36;repaint()}
 function back(){x.token++;x.combinedBusy=false;x.running=false;x.set=null;x.cards=[];x.search="";x.rarity="all";repaint();window.scrollTo(0,0)}
 async function openArtist(group){
  const who=group==="komiya"?"Tomokazu Komiya":group==="kanda"?"Shinji Kanda":null;
  if(!who)return;
  const t=++x.token;x.working=true;x.setError="";x.set={id:"artist-"+group,name:who+" · Illustrator Collection",artistName:who,releaseDate:"",cardCount:{total:0}};x.cards=[];x.details={};x.search="";x.rarity="all";x.sort="rarity";x.limit=48;x.progress=0;x.running=false;
  repaint();window.scrollTo(0,0);
  try{
    const raw=await fetchJSON("/cards?illustrator="+encodeURIComponent("eq:"+who));
    if(x.token!==t)return;
    if(!Array.isArray(raw))throw Error("Illustrator catalog unavailable");
    x.cards=raw.map(c=>({...c,id:token(c.id)}));x.set.cardCount.total=x.cards.length;
    x.working=false;repaint();enrich(t);
  }catch(e){if(x.token!==t)return;x.working=false;x.setError=e.message;repaint()}
 }
 
 async function openAllGroup(){
   if(!x.sets){await loadSets();if(!x.sets)return}
   const eligible=x.sets.filter(groupMatch);
   if(!eligible.length)return;
   const group=x.group,caption=groups.find(g=>g[0]===group)?.[1]||"Cards";
   x.token++;
   x.set={id:"all-group-"+group,name:"All "+caption+" Cards",combinedGroup:true,group,cardCount:{total:0}};
   x.combinedSets=eligible;x.combinedNext=0;x.combinedBusy=false;x.combinedFailures=0;
   x.cards=[];x.details={};x.search="";x.rarity="all";x.sort="number";x.limit=48;
   x.working=false;x.setError="";x.progress=0;x.running=false;
   repaint();window.scrollTo(0,0);
   await loadMoreGroupSets();
 }
 async function loadMoreGroupSets(){
   if(!x.set?.combinedGroup||x.combinedBusy||x.combinedNext>=x.combinedSets.length)return;
   const t=x.token;x.combinedBusy=true;
   const first=x.combinedNext;
   const count=x.set.group==="tg"?4:3;
   const chunk=x.combinedSets.slice(first,first+count);
   repaint();
   const settled=await Promise.allSettled(chunk.map(async ss=>{
     const full=await fetchJSON("/sets/"+encodeURIComponent(ss.id));
     if(!Array.isArray(full.cards))throw Error("Missing cards for "+ss.name);
     return full.cards.map(c=>({...c,id:token(c.id),_set:ss}));
   }));
   if(t!==x.token)return;
   const present=new Set(x.cards.map(c=>c.id));
   for(const result of settled){
     if(result.status==="fulfilled"){for(const c of result.value){if(!present.has(c.id)){present.add(c.id);x.cards.push(c)}}}
     else x.combinedFailures++;
   }
   x.combinedNext=first+chunk.length;x.set.cardCount.total=x.cards.length;
   x.combinedBusy=false;
   if(!x.cards.length&&x.combinedNext>=x.combinedSets.length)x.setError="No cards could be loaded from this category.";
   repaint();
   // Enrich the visible cards in small batches; downloading every card across
   // a large category at once would overwhelm a mobile connection.
   if(x.cards.length&&!x.running)enrich(t);
 }
 function retryGroup(){if(x.set?.combinedGroup){x.setError="";if(x.combinedNext>=x.combinedSets.length)x.combinedNext=0;loadMoreGroupSets()}}
 async function openAllTG(){x.group="tg";return openAllGroup()}
 async function openSet(id){
   if(!/^[a-zA-Z0-9._+-]+$/.test(id))return;
   const t=++x.token;x.working=true;x.setError="";x.set=x.sets?.find(s=>s.id===id)||{id,name:id};x.cards=[];x.details={};x.search="";x.rarity=x.group==="arts"?"ir":"all";x.sort="rarity";x.limit=48;x.progress=0;x.running=false;
   repaint();window.scrollTo(0,0);
   try{
     const s=await fetchJSON("/sets/"+encodeURIComponent(id));if(x.token!==t)return;
     x.set=s;x.cards=(s.cards||[]).map(c=>({...c,id:token(c.id)}));if(!Array.isArray(s.cards))throw Error("Incomplete card data");
     const old=cache().details?.[id]?.cards||[];
     x.details=Object.fromEntries(old.filter(v=>v&&v.id).map(v=>[v.id,{rarity:v.rarity||""}]));
     x.progress=Object.keys(x.details).length;x.working=false;repaint();enrich(t);
   }catch(e){if(x.token!==t)return;x.working=false;x.setError=e.message;repaint()}
 }
 async function enrich(t){
   const detailCap=navigator.connection?.saveData?Math.min(x.limit,24):x.limit+12;
   const todo=x.cards.slice(0,Math.min(x.cards.length,detailCap)).filter(c=>!x.details[c.id]);if(!todo.length||document.hidden)return;
   x.running=true;let index=0,finished=0;
   async function worker(){
     while(t===x.token && index<todo.length){
       const c=todo[index++];
       try{const obj=await fetchJSON("/cards/"+encodeURIComponent(c.id));if(t!==x.token)return;x.details[c.id]={rarity:obj.rarity||"",illustrator:obj.illustrator||"",set:obj.set||null};if(x.set?.artistName){c.set=obj.set||c.set;c.rarity=obj.rarity||c.rarity;c.illustrator=obj.illustrator||c.illustrator}}
       catch{if(t!==x.token)return;x.details[c.id]={rarity:""}}
       finished++;x.progress++;
       if(!document.hidden&&(finished%24===0||finished===todo.length))repaintCards();
     }
   }
   await Promise.all(Array.from({length:Math.min(navigator.connection?.saveData?1:2,todo.length)},worker));
   if(t===x.token){
      x.running=false;
      const data=cache(),details=data.details||{};
      details[x.set.id]={at:Date.now(),cards:Object.entries(x.details).map(([id,a])=>({id,rarity:a.rarity||""}))};
      store({details});repaintCards();
   }
 }
 function searchCards(q){x.search=q;x.limit=48;repaintCards()}
 function rarityFilter(r){x.rarity=r;x.limit=48;repaintCards()}
 function sortCards(v){x.sort=v;x.limit=48;repaintCards()}
 function moreCards(){x.limit+=48;repaintCards();if(x.set&&!x.running)enrich(x.token)}
 function owner(v){x.owner=v}
 function category(c){
   const r=(x.details[c.id]?.rarity||"").toLowerCase();
   const cardSet=x.set?.combinedGroup?c._set:x.set;
   if(isTG(cardSet))return "Trainer Gallery";
   if(isGG(cardSet))return "Galarian Gallery";
   if(isPromo(cardSet))return "Black Star Promo";
   if(r.includes("special illustration"))return "Special Illustration Rare";
   if(r.includes("illustration"))return "Illustration Rare";
   if(r.includes("hyper")||r.includes("secret"))return "Gold / Hyper Rare";
   if(r.includes("ultra")||r.includes("full art"))return "Full Art";
   if(/^(199\d|200\d)/.test(date(cardSet)))return "Vintage";
   return "Other";
 }
 function add(id){
   const card=x.cards.find(c=>c.id===id);if(!card||!x.set)return;
   let row=findOwned(card);
   if(!row){
     row={id:"ex-"+card.id,tcgdexId:card.id,name:card.name,set:x.set.combinedGroup?card._set.name:x.set.artistName?(card.set?.name||card.id.split("-")[0]):x.set.name,setId:x.set.combinedGroup?card._set.id:x.set.artistName?(card.set?.id||card.id.split("-")[0]):x.set.id,illustrator:x.set.artistName||x.details[card.id]?.illustrator||"",number:sourceNum(card,x.set),category:category(card),image:(isTG(x.set?.combinedGroup?card._set:x.set)||isGG(x.set?.combinedGroup?card._set:x.set))?alternativeScan(card)||card.image+"/low.webp":card.image?card.image+"/low.webp":alternativeScan(card),rarity:x.details[card.id]?.rarity||"",rank:null,referencePrice:null};
     db.cards.push(row);
   }
   const old=db.statuses[row.id]||{},oldQty=isOwned(row)?Math.max(1,Number(old.qty)||0):0;
   db.statuses[row.id]={...old,state:"Owned",qty:oldQty+1,owner:x.owner,condition:old.condition||"NM"};
   save(); // preserves local JSON and cloud opt-in behavior; does not alter purchase spending.
   const toast=document.getElementById("px-toast");
   if(toast){toast.textContent=card.name+" added to My Binder";toast.hidden=false;setTimeout(()=>toast.hidden=true,2200)}
 }
 function render(){
   if(!x.sets&&!x.loading)Promise.resolve().then(loadSets);
   return `<div id="px-main">${window.PokeAllCards?.active?window.PokeAllCards.render():(x.set?selectedPanel():setsPanel())}</div><div id="px-toast" role="status" hidden></div>`;
 }
 const styles=`<style id="pokeledger-explorer">
 .px-viewall-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:#edf6ff;border:1px solid #c5ddfa;border-radius:14px;padding:13px 16px;margin:12px 0}.px-viewall-banner b{display:block;color:#235a9f}.px-viewall-banner small{display:block;color:#617895;font-size:11px}.px-head{padding:19px;background:#fff;border:1px solid #dce8f5;border-radius:20px;margin:12px 0 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}.px-head h1{font-size:24px}.px-head p{color:#667992;font-size:13px;margin:5px 0}.px-kicker{font-size:10px;font-weight:900;color:#2f71c9;letter-spacing:1px}.px-tabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:13px;scrollbar-width:thin}.px-chip{flex:none;background:#fff;color:#375b8c;border:1px solid #d3dfec;border-radius:30px;font-size:12px;padding:10px 14px;font-weight:800}.px-chip.active{background:#e8f3ff;color:#1558b4;border-color:#71a5ef}.px-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px}.px-controls input.field{flex:2;min-width:170px}.px-controls select.field{flex:1;min-width:120px;max-width:220px}.px-controls span{font-size:11px;color:#66809c;font-weight:700}.px-setgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}.px-set{min-width:0;min-height:147px;padding:14px 8px;display:flex;flex-direction:column;align-items:center;justify-content:space-around;gap:8px;background:#fff;color:#273d62;border:1px solid #dfe7f3;border-radius:17px;text-align:center;cursor:pointer}.px-set:hover{border-color:#70a5ee}.px-set strong{font-size:12px;line-height:1.25}.px-set small{font-size:10px;color:#75859f}.px-setlogo{width:90%;height:56px;object-fit:contain}.px-emoji{font-size:30px}.px-more{display:block;margin:20px auto;padding:10px 18px}.px-note{font-size:11px;color:#71839d;margin:16px 0 26px}.px-empty{border:1px dashed #bdcde4;border-radius:16px;background:#fff;text-align:center;padding:35px;color:#57718e;margin:15px 0}.px-selected{justify-content:flex-start}.px-selectedlogo{max-width:115px;max-height:75px;object-fit:contain}.px-progress{background:#e5eefb;height:8px;border-radius:8px;margin-top:9px;overflow:hidden}.px-progress>div{height:100%;background:#347bc9}.px-cardgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}.px-card{border:1px solid #e2e8f3;border-radius:14px;background:#fff;overflow:hidden;min-width:0;content-visibility:auto;contain-intrinsic-size:auto 350px}.px-artbox{position:relative;background:#f4f8ff;min-height:135px}.px-art{width:100%;aspect-ratio:0.72;display:block;object-fit:contain}.px-noimage{aspect-ratio:0.72;display:flex;align-items:center;justify-content:center;color:#75859a;text-align:center;font-size:11px}.px-owned{position:absolute;left:5px;top:5px;border-radius:15px;padding:3px 6px;color:#126b4a;background:#d8f3e7;font-size:9px;font-weight:900}.px-cardinfo{padding:9px;display:flex;flex-direction:column;gap:5px}.px-cardinfo strong{font-size:12px;line-height:1.2;min-height:29px}.px-cardinfo small{font-size:10px;color:#7686a0}.px-add{border-radius:8px;background:#2c70cb;color:#fff;border:1px solid #275fac;padding:8px 4px;font-size:10px;font-weight:800}.px-add.yes{color:#167151;background:#e1f6e9;border-color:#abd4be}.px-market{background:#eef5ff;color:#2868b6;border-color:#d4e5fb}.px-status{display:flex;justify-content:space-between;gap:10px;margin:11px 0;font-size:11px;color:#6b7d98}.px-status span{color:#3d79be}#px-toast{position:fixed;bottom:82px;left:50%;transform:translateX(-50%);border-radius:30px;padding:12px 17px;background:#2460b6;color:white;z-index:50;font-weight:700;font-size:12px;box-shadow:0 8px 24px #225c9270}#px-toast[hidden]{display:none}
 @media(max-width:750px){.px-setgrid,.px-cardgrid{grid-template-columns:repeat(3,minmax(0,1fr))}}
 @media(max-width:550px){.px-head{padding:14px}.px-head h1{font-size:21px}.px-head p{font-size:12px}.px-setgrid,.px-cardgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.px-set{min-height:140px}.px-controls input.field{flex:1 1 100%}.px-controls select.field{flex:1 1 47%;max-width:none}.px-selectedlogo{max-width:75px;max-height:60px}}
 </style>`;
 document.head.insertAdjacentHTML("beforeend",styles);
 window.explorer=render;window.pxLoad=loadSets;window.pxGroup=selectGroup;window.pxSearchSets=searchSets;window.pxMoreSets=moreSets;window.pxCard=id=>{const c=x.cards.find(item=>item.id===id);return c?{...c,set:c.set||(x.set?.combinedGroup?c._set?.name:x.set?.name)||'',number:sourceNum(c,x.set)}:null};window.pxAllGroup=openAllGroup;window.pxLoadMoreGroup=loadMoreGroupSets;window.pxRetryGroup=retryGroup;window.pxAllTG=openAllTG;window.pxOpen=openSet;window.pxArtist=openArtist;window.pxBack=back;window.pxSearchCards=searchCards;window.pxRarity=rarityFilter;window.pxSort=sortCards;window.pxMoreCards=moreCards;window.pxOwner=owner;window.pxAdd=add;
})();