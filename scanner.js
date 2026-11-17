(function(){
"use strict";
const API="https://api.tcgdex.net/v2/en";
const E=t=>String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const S={stream:null,worker:null,loading:null,scanning:false,auto:false,timer:null,candidates:[],lastText:"",lastScan:"",fromUpload:false,lastBitmap:null,token:0};
const validID=id=>/^[\w.+-]+$/.test(String(id||""));
const cropCanvas=()=>document.createElement("canvas");
function state(msg,kind=""){const el=document.getElementById("psc-status");if(el){el.textContent=msg;el.dataset.kind=kind}}
function photoHTML(){
return '<header class="psc-head"><div><span class="psc-tag">POKÉLEDGER · RAPID SCAN TEST</span><h1>Scan Pokémon Cards</h1><p>Camera or photo → OCR → confirm exact card → add to your collection</p></div></header>'+
'<div class="psc-layout"><div class="psc-camera"><div class="psc-viewport"><video id="psc-video" autoplay muted playsinline></video><div class="psc-guides"><span>Align one card inside the frame</span><div class="psc-guidebox"></div></div></div><canvas id="psc-canvas" hidden></canvas><div class="psc-actions"><button class="btn primary" onclick="pscStart()">Start camera</button><button class="btn" onclick="pscCapture()">Read card</button><button class="btn" id="psc-auto" onclick="pscAuto()">Auto: OFF</button><button class="btn" onclick="pscStop()">Stop</button></div><label class="psc-upload">Or upload a card photo <input type="file" accept="image/*" onchange="pscUpload(this)" aria-label="Upload a photo of one Pokémon card"></label><p id="psc-status" class="psc-state" role="status">Camera is off. Start the camera or upload a photo to test recognition.</p><p class="psc-tip">First recognition loads the OCR engine and English data. Subsequent scans reuse it. Photos are processed on this device; card names are searched using TCGdex.</p></div>'+
'<div class="psc-results"><label>Search manually or correct an OCR result<input id="psc-manual" class="field" type="search" placeholder="Eevee, Charizard ex, Pikachu…" onkeydown="if(event.key===\'Enter\'){event.preventDefault();pscSearch()}"></label><div class="psc-actions"><button class="btn primary" onclick="pscSearch()">Find card</button><button class="btn" onclick="pscClear()">Clear results</button></div><div class="psc-choice"><label>Card belongs to<select id="psc-owner" class="field">'+db.members.map(m=>'<option value="'+E(m)+'">'+E(m)+'</option>').join("")+'</select></label><label>Collection binder<select id="psc-binder" class="field">'+(window.PokeCollections?.binderOptions?.()||'<option value="">Main collection</option>')+'</select></label></div><div id="psc-results"><div class="psc-placeholder">Matches will appear here with card artwork, set, and number. Confirm the correct printing before saving.</div></div></div></div>'+
'<div class="psc-disclaimer">This is an OCR-based scanner, not artwork-based visual identification. Similar printings can look alike. Always verify the set, collector number, and variant. Camera needs HTTPS and permission; internet is required for the recognition library and card lookups.</div>';
}
function render(){return '<div id="psc-root">'+photoHTML()+'</div>'}
let cameraRequest=0;
function stop(){cameraRequest++;S.auto=false;S.token++;if(S.timer)clearTimeout(S.timer);S.timer=null;if(S.stream){S.stream.getTracks().forEach(t=>t.stop());S.stream=null}const video=document.getElementById("psc-video");if(video){video.pause();video.srcObject=null;}const auto=document.getElementById("psc-auto");if(auto)auto.textContent="Auto: OFF";}
async function start(){
 if(!navigator.mediaDevices?.getUserMedia)return state("Camera unavailable. Upload a photo instead.");
 stop();
 const request=cameraRequest;
 try{
  const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:960}}});
  const video=document.getElementById("psc-video");
  if(request!==cameraRequest || document.hidden || !video){
   acquired.getTracks().forEach(track=>track.stop());
   return;
  }
  S.stream=acquired;
  video.srcObject=acquired;
  await video.play();
  if(request===cameraRequest)state("Camera ready. "+"Position one card and tap Read card.");
 }catch(error){
  if(request!==cameraRequest)return;
  stop();
  state("Camera could not start. Upload a photo or retry. "+error.message);
 }
}
function frameArea(sw,sh,vw,vh,x,y,w,h){
 const scale=Math.max(vw/sw,vh/sh);
 const offsetX=(sw*scale-vw)/2,offsetY=(sh*scale-vh)/2;
 return [(x+offsetX)/scale,(y+offsetY)/scale,w/scale,h/scale];
}
function makeFrame(){
 const video=document.getElementById("psc-video");if(!video||!S.stream||!video.videoWidth)throw Error("Start the camera and allow it to focus on the card.");
 const bounds=video.getBoundingClientRect();
 const guide=document.querySelector(".psc-guidebox").getBoundingClientRect();
 const area=frameArea(video.videoWidth,video.videoHeight,bounds.width,bounds.height,
   guide.left-bounds.left,guide.top-bounds.top,guide.width,guide.height);
 const c=cropCanvas();c.width=780;c.height=1092;
 c.getContext("2d").drawImage(video,...area,0,0,c.width,c.height);return c;
}
function frameFromImage(img){
 const c=cropCanvas();c.width=780;c.height=1092;const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
 const dw=iw/ih>0.72?ih*.72:iw,dh=dw/0.72,x=(iw-dw)/2,y=(ih-dh)/2;
 c.getContext("2d").drawImage(img,x,y,dw,dh,0,0,c.width,c.height);return c;
}
async function getWorker(){
 if(S.worker)return S.worker;
 if(S.loading)return S.loading;
 S.loading=(async()=>{
 if(!window.Tesseract){
   await new Promise((resolve,reject)=>{const tag=document.createElement("script");tag.src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";tag.onload=resolve;tag.onerror=()=>reject(Error("OCR library download failed"));document.head.appendChild(tag)});
 }
 if(!window.Tesseract?.createWorker)throw Error("OCR library could not initialize");
 S.worker=await window.Tesseract.createWorker("eng");
 return S.worker;
 })();
 try{return await S.loading}finally{S.loading=null}
}
const normalize=s=>String(s||"").toLowerCase().replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
const localNum=s=>String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
function parseText(text){
 const lines=String(text).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const possible=lines.map(l=>l.replace(/(?:\bHP\b\s*\d+|\d+\s*\bHP\b)/ig,"").replace(/[^A-Za-z0-9' -]/g," ").trim())
  .filter(l=>l.length>2&&l.length<36&&!/^(basic|stage|trainer|supporter|item|energy|weakness|resistance|retreat|illustrator|ability|pok.mon|the pok.mon|level|evolves|rule|damage|draw|attack)/i.test(l));
 const findNumber=text.match(/\b(?:TG\d{1,2}|GG\d{1,2}|SVP\s?\d{1,3}|[A-Z]{0,2}\d{1,3})\s*\/\s*(?:[A-Z]{0,2}\d{2,3})\b/i);
 const matchNum=findNumber?findNumber[0].split("/")[0].replace(/\s+/g,""):"";
 return {queries:[...new Set(possible.map(l=>l.replace(/\s+\d+$/,"").trim()))].slice(0,3),number:matchNum,lines};
}
async function apiSearch(name){
 const params=new URLSearchParams({"name":name,"pagination:page":"1","pagination:itemsPerPage":"200"});
 const res=await fetch(API+"/cards?"+params.toString());
 if(!res.ok)throw Error("Card search failed ("+res.status+")");
 const list=await res.json();return Array.isArray(list)?list:[];
}
function score(c,query,num){
 const name=normalize(c.name),a=normalize(query);
 let value=name===a?100:name.includes(a)?60:a.includes(name)?40:0;
 if(num&&localNum(c.localId)===localNum(num))value+=140;
 if(String(c.id).startsWith("swsh")&&String(num).toUpperCase().startsWith("TG"))value+=20;
 return value;
}
async function loadCandidatePrices(candidates){
 await Promise.allSettled(candidates.slice(0,3).map(async c=>{
  if(!document.getElementById("psc-price-"+c.id))return;
  try{
   const item=await window.PokeMarket?.load?.(c.id);
   const quote=window.PokeGallery.sources(item);
   const element=document.getElementById("psc-price-"+c.id);
   if(element){element.textContent=quote.label;element.title=quote.title}
  }catch{const element=document.getElementById("psc-price-"+c.id);if(element)element.textContent="TCGplayer Market Price unavailable"}
 }));
}
function printMatches(list,meta){
 S.candidates=list;
 const host=document.getElementById("psc-results");if(!host)return;
 if(!list.length){host.innerHTML='<div class="psc-placeholder">No confident matches. Try entering the card name in the search box, then choose the correct set and number.</div>';return}
 const hint=meta?'<p class="psc-tip">Detected: '+E(meta)+' · verify the card number and variant</p>':"";
 host.innerHTML=hint+'<div class="psc-matches">'+list.slice(0,12).map(c=>'<article class="psc-item"><button type="button" class="pk-card-tap psc-preview" onclick="pkZoom(\''+E(c.id)+'\',\'scanner\')" aria-label="Enlarge '+E(c.name)+'"><img src="'+E(c.image?c.image+"/low.webp":"")+'" loading="lazy" alt="'+E(c.name)+'" onerror="this.style.visibility=\'hidden\'"></button><div><b>'+E(c.name)+'</b><small>'+E(c.id)+' · #'+E(c.localId||"")+'</small><div class="psc-price" id="psc-price-'+E(c.id)+'">Raw value: checking…</div><div class="psc-actions"><button class="btn primary sm" onclick="pscAdd(\''+E(c.id)+'\')">✓ Add owned</button><button class="btn sm" onclick="pmOpen(\''+E(c.id)+'\')">Value / sources</button></div></div></article>').join("")+'</div>';
 loadCandidatePrices(list);
}
async function search(raw){
 if(S.scanning)return;
 const q=String(raw||"").trim();
 if(!q){state("Type a card name or scan a card first.","error");return}
 state("Looking up matching cards…");
 try{const matches=await apiSearch(q);matches.sort((a,b)=>score(b,q,"")-score(a,q,""));printMatches(matches.slice(0,12),"Search: "+q);state(matches.length+" possible matches. Confirm the exact card before adding.");}
 catch(e){state("Search unavailable: "+e.message,"error")}
}
async function manual(){return search(document.getElementById("psc-manual")?.value)}
async function recognize(c){
 if(S.scanning)return;
 S.scanning=true;state("Reading printed text…");
 try{
 const worker=await getWorker();const result=await worker.recognize(c);
 const text=result.data?.text||"";S.lastText=text;
 const parsed=parseText(text);if(!parsed.queries.length&&!parsed.number){state("Could not read a name. Improve lighting, bring the card closer, or type its name.","error");printMatches([]);return}
 state("Looking for "+(parsed.queries[0]||parsed.number)+"…");
 const found=new Map();let chosen="";
 for(const term of parsed.queries.slice(0,3)){
  try{const list=await apiSearch(term);if(!chosen&&list.length)chosen=term;for(const c of list.slice(0,200))found.set(c.id,c);if(found.size>250)break}catch{}
 }
 if(!found.size&&parsed.number){
  const list=await fetch(API+"/cards?"+new URLSearchParams({localId:parsed.number,"pagination:itemsPerPage":"100","pagination:page":"1"})).then(r=>r.ok?r.json():[]);for(const c of list)found.set(c.id,c);
 }
 const best=[...found.values()].sort((a,b)=>score(b,chosen||parsed.queries[0],parsed.number)-score(a,chosen||parsed.queries[0],parsed.number)).slice(0,12);
 printMatches(best,parsed.queries[0]+(parsed.number?" · "+parsed.number:""));
 state(best.length?best.length+" suggested matches. Review and add the correct one.":"No match from OCR. Use manual name search.",best.length?"":"error");
 }catch(e){state("Recognition failed: "+e.message+" . Use a photo or manual search.","error")}
 finally{S.scanning=false;}
}
async function capture(){
 if(S.scanning)return;try{await recognize(makeFrame())}catch(e){state(e.message,"error")}
}
function auto(){
 const video=document.getElementById("psc-video");if(!video||!S.stream){state("Start the camera before enabling auto-scan.","error");return}
 S.auto=!S.auto;const el=document.getElementById("psc-auto");if(el)el.textContent=S.auto?"Auto: ON":"Auto: OFF";
 if(S.auto){const key=++S.token;const cycle=async()=>{if(!S.auto||key!==S.token||!S.stream||page!=="scanner"||document.hidden){if(document.hidden)stop();return;}if(!S.scanning)await capture();if(S.auto&&key===S.token){S.timer=setTimeout(cycle,3500)}};cycle()}
 else{S.token++;if(S.timer)clearTimeout(S.timer);}
}
async function upload(input){
 const file=input?.files?.[0];if(!file)return;
 const url=URL.createObjectURL(file);const img=new Image();img.onload=async()=>{try{const frame=frameFromImage(img);await recognize(frame)}catch(e){state(e.message,"error")}finally{URL.revokeObjectURL(url);input.value=""}};img.onerror=()=>{state("Could not read that image file.","error");URL.revokeObjectURL(url)};img.src=url;
}
function clear(){S.candidates=[];printMatches([]);state("Results cleared.");}
async function add(id){
 const card=S.candidates.find(c=>c.id===id);if(!card)return;state("Saving selected card…");
 try{
  const detail=window.PokeMarket?.load?await window.PokeMarket.load(id):await fetch(API+"/cards/"+encodeURIComponent(id)).then(r=>r.json());
  const owned=allCards().find(c=>c.tcgdexId===id||c.id==="ex-"+id);
  let row=owned;
  if(!row){row={id:"ex-"+id,tcgdexId:id,name:detail.name||card.name,set:detail.set?.name||id.split("-")[0],setId:detail.set?.id||"",number:String(detail.localId||card.localId||""),category:/special illustration/i.test(detail.rarity||"")?"Special Illustration Rare":/illustration/i.test(detail.rarity||"")?"Illustration Rare":/trainer gallery/i.test(detail.rarity||"")?"Trainer Gallery":/galarian gallery/i.test(detail.rarity||"")?"Galarian Gallery":/ultra|full art/i.test(detail.rarity||"")?"Full Art":"Other",rarity:detail.rarity||"",illustrator:detail.illustrator||"",image:detail.image?detail.image+"/low.webp":card.image?card.image+"/low.webp":"",referencePrice:null,rank:null};db.cards.push(row)}
  const previous=db.statuses[row.id]||{},n=["Owned","Grading"].includes(previous.state)?Math.max(1,Number(previous.qty)||1):0;
  const owner=document.getElementById("psc-owner")?.value||"Me";
  db.statuses[row.id]={...previous,state:"Owned",qty:n+1,owner,condition:previous.condition||"NM"};
  const binder=document.getElementById("psc-binder")?.value||"";
  if(window.PokeCollections?.assign)window.PokeCollections.assign(row.id,binder,false);
  persist();scheduleCloudSave();
  state(row.name+" saved to My Collection · quantity "+(n+1)+". Ready for next scan.","ok");
 }catch(e){state("Could not save card: "+e.message,"error")}
}
const style='<style id="psc-style">.psc-head{border:1px solid #d8e6f9;background:#fff;border-radius:18px;padding:20px;margin:0 0 14px}.psc-tag{font-size:10px;font-weight:900;color:#2366bf;letter-spacing:1.3px}.psc-head h1{font-size:25px}.psc-head p{color:#71839e;font-size:13px}.psc-layout{display:grid;grid-template-columns:1.07fr 1fr;gap:14px}.psc-camera,.psc-results{background:#fff;border:1px solid #deebf8;border-radius:17px;padding:14px;min-width:0}.psc-viewport{position:relative;aspect-ratio:3/4;overflow:hidden;border-radius:12px}.psc-camera video{display:block;background:#142845;width:100%;height:100%;object-fit:cover;border-radius:12px}.psc-guides{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;text-align:center}.psc-guides span{position:absolute;top:2%;left:0;right:0;color:#fff;background:#143760ae;padding:4px;border-radius:7px;font-size:11px}.psc-guidebox{height:80%;aspect-ratio:5/7;border:2px dashed #fae17c;border-radius:9px;box-shadow:0 0 0 1px #1c304e}.psc-actions{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.psc-actions button{font-size:12px;padding:9px}.psc-upload{display:block;margin:6px 0;padding:12px;background:#f2f7ff;border:1px solid #cfe0f7;border-radius:11px;font-weight:700;cursor:pointer}.psc-upload input{display:block;font-size:12px;margin-top:7px;max-width:100%}.psc-state{font-size:13px;color:#1b5e9c;padding:12px;background:#ecf5ff;border-radius:10px;min-height:46px}.psc-state[data-kind="error"]{color:#a4333b;background:#fff2f2}.psc-state[data-kind="ok"]{color:#176943;background:#e8f7ee}.psc-tip,.psc-disclaimer{font-size:11px;color:#72839b;margin:12px 0}.psc-disclaimer{padding:12px}.psc-choice{display:grid;grid-template-columns:1fr 1fr;gap:9px}.psc-choice label,.psc-results label{display:block;font-size:12px;font-weight:750;margin:8px 0}.psc-choice select{margin-top:4px}.psc-matches{display:grid;gap:8px;max-height:660px;overflow:auto}.psc-item{display:flex;gap:10px;background:#f9fbff;border:1px solid #e4edf9;border-radius:13px;padding:10px}.psc-item img{width:78px;min-width:78px;height:110px;object-fit:contain}.psc-item b{display:block;font-size:14px}.psc-item small{display:block;color:#7486a0;font-size:10px;overflow-wrap:anywhere}.psc-price{font-size:11px;font-weight:750;color:#2465ab;margin-top:5px}.psc-placeholder{border:1px dashed #cbddee;border-radius:12px;color:#637894;text-align:center;padding:25px;font-size:12px}@media(max-width:750px){.psc-layout{grid-template-columns:1fr}}</style>';
document.head.insertAdjacentHTML("beforeend",style);
window.addEventListener("pagehide",stop);
document.addEventListener("visibilitychange",()=>{if(document.hidden)stop()});
window.PokeScanner={frameArea,render,start,capture,auto,stop,upload,search:manual,clear,add,card:id=>S.candidates.find(c=>c.id===id)};
window.pscStart=start;window.pscCapture=capture;window.pscAuto=auto;window.pscStop=()=>{stop();state("Camera stopped.")};window.pscUpload=upload;window.pscSearch=manual;window.pscClear=clear;window.pscAdd=add;
})();