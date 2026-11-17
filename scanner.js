(function(){
"use strict";
const API="https://api.tcgdex.net/v2/en";
const E=t=>String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const S={stream:null,worker:null,loading:null,scanning:false,auto:false,timer:null,candidates:[],lastText:"",lastScan:"",fromUpload:false,lastBitmap:null,token:0,operation:0,abort:null};
const validID=id=>/^[\w.+-]+$/.test(String(id||""));
const cropCanvas=()=>document.createElement("canvas");
function state(msg,kind=""){const el=document.getElementById("psc-status");if(el){el.textContent=msg;el.dataset.kind=kind}}
function photoHTML(){
return '<header class="psc-head"><div><span class="psc-tag">POKÉLEDGER · RAPID SCAN TEST</span><h1>Scan Pokémon Cards</h1><p>Camera or photo → OCR → confirm exact card → add to your collection</p></div></header>'+
'<div class="psc-layout"><div class="psc-camera"><div class="psc-viewport"><video id="psc-video" autoplay muted playsinline></video><div class="psc-guides"><span>Align one card inside the frame</span><div class="psc-guidebox"></div></div></div><canvas id="psc-canvas" hidden></canvas><div class="psc-actions"><button class="btn primary" onclick="pscStart()">Start camera</button><button class="btn" onclick="pscCapture()">Read card</button><button class="btn" id="psc-auto" onclick="pscAuto()">Auto: OFF</button><button class="btn" onclick="pscStop()">Stop</button></div><label class="psc-upload">Or upload a card photo <input type="file" accept="image/*" onchange="pscUpload(this)" aria-label="Upload a photo of one Pokémon card"></label><p id="psc-status" class="psc-state" role="status">Camera is off. Start the camera or upload a photo to test recognition.</p><p class="psc-tip">First recognition loads the OCR engine and English data. Subsequent scans reuse it. Photos are processed on this device; card names are searched using TCGdex.</p></div>'+
'<div class="psc-results"><label>Search manually or correct an OCR result<input id="psc-manual" class="field" type="search" placeholder="Eevee, Charizard ex, Pikachu…" onkeydown="if(event.key===\'Enter\'){event.preventDefault();pscSearch()}"></label><label>Collector number (optional)<input id="psc-number" class="field" placeholder="023, TG01, 198/165" onkeydown="if(event.key===\'Enter\'){event.preventDefault();pscSearch()}"></label><div class="psc-actions"><button class="btn primary" onclick="pscSearch()">Find card</button><button class="btn" onclick="pscClear()">Clear results</button></div><div class="psc-choice"><label>Card belongs to<select id="psc-owner" class="field">'+db.members.map(m=>'<option value="'+E(m)+'">'+E(m)+'</option>').join("")+'</select></label><label>Collection binder<select id="psc-binder" class="field">'+(window.PokeCollections?.binderOptions?.()||'<option value="">Main collection</option>')+'</select></label></div><div id="psc-results"><div class="psc-placeholder">Matches will appear here with card artwork, set, and number. Confirm the correct printing before saving.</div></div></div></div>'+
'<div class="psc-disclaimer">This is an OCR-based scanner, not artwork-based visual identification. Similar printings can look alike. Always verify the set, collector number, and variant. Camera needs HTTPS and permission; internet is required for the recognition library and card lookups.</div>';
}
function render(){return '<div id="psc-root">'+photoHTML()+'</div>'}
let cameraRequest=0;
function stop(){cameraRequest++;S.operation++;S.abort?.abort();S.auto=false;S.token++;if(S.timer)clearTimeout(S.timer);S.timer=null;if(S.stream){S.stream.getTracks().forEach(t=>t.stop());S.stream=null}const video=document.getElementById("psc-video");if(video){video.pause();video.srcObject=null;}const auto=document.getElementById("psc-auto");if(auto)auto.textContent="Auto: OFF";}
async function start(){
 if(!navigator.mediaDevices?.getUserMedia)return state("Camera unavailable. Upload a photo instead.");
 stop();
 const request=cameraRequest;
 try{
  const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1440}}});
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
 const c=cropCanvas();c.width=1040;c.height=1456;
 c.getContext("2d").drawImage(video,...area,0,0,c.width,c.height);return c;
}
function frameFromImage(img){
 const c=cropCanvas();c.width=1040;c.height=1456;const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
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
const normalize=s=>String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\blv[.\s]*x\b/g," lvx ").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
const localNum=s=>String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"").replace(/^0+(?=\d)/,"");
const ignored=new Set("a an and as at by for from in into of on or s the to with your you card cards pokemon basic stage hp ex gx v vmax vstar mega m x y lvx radiant dark light team rocket energy".split(" "));
let nameCatalog=null;
async function getNames(){
 if(!nameCatalog)nameCatalog=fetch("./data/card-names.json").then(response=>{
  if(!response.ok)throw Error("Name index unavailable");
  return response.json();
 }).catch(error=>{nameCatalog=null;throw error});
 return nameCatalog;
}
function distance(a,b,limit=2){
 if(Math.abs(a.length-b.length)>limit)return limit+1;
 let row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const next=[i];
  for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));
  if(Math.min(...next)>limit)return limit+1;
  row=next;
 }
 return row[b.length];
}
function nameQueries(text,names){
 const tokens=[...new Set(normalize(text).split(" "))].slice(0,60);
 const words=tokens.filter(token=>token.length>=3 && !ignored.has(token) && /^[a-z0-9]+$/.test(token) && /[a-z]/.test(token));
 const evidence=new Map();
 for(const name of names){
  for(const word of normalize(name).split(" ")){
   if(word.length<3 || ignored.has(word) || evidence.has(word))continue;
   const limit=word.length>=7?2:word.length>=5?1:0;
   const errors=words.map(token=>distance(token,word,limit));
   const best=errors.length?Math.min(...errors):3;
   evidence.set(word,best<=limit?1-best/word.length:0);
  }
 }
 const ranked=names.map(name=>{
  const parts=normalize(name).split(" "),keys=parts.filter(part=>part.length>=3&&!ignored.has(part));
  if(!keys.length || keys.some(key=>!evidence.get(key)))return null;
  const quality=Math.min(...keys.map(key=>evidence.get(key)))*100;
  const specific=parts.filter(part=>["mega","x","y","ex","gx","v","vmax","vstar"].includes(part)&&tokens.includes(part)).length*4;
  return {name,score:quality+specific};
 }).filter(Boolean).sort((a,b)=>b.score-a.score||a.name.length-b.name.length);
 const seen=new Set();
 return ranked.filter(item=>{const key=item.name.toLowerCase();if(seen.has(key))return false;seen.add(key);return true}).slice(0,3).map(item=>item.name);
}
function parseText(text){
 const lines=String(text||"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 const fraction=String(text).match(/\b((?:TG|GG|SV)?\d{1,3})\s*[/|]\s*((?:TG|GG)?\d{2,3})\b/i);
 const promo=String(text).match(/\b(?:SVP|SWSH|SM|XY|MEP)\s*(?:EN\s*)?(\d{1,3})\b/i);
 const number=fraction?fraction[1]:promo?promo[1]:"";
 const queries=lines.map(line=>line.replace(/(?:\bHP\b\s*\d+|\d+\s*\bHP\b)/ig,"").replace(/[^A-Za-z' -]/g," ").replace(/\s+/g," ").trim())
  .filter(line=>line.length>3&&line.length<40&&!/^(basic|stage|trainer|supporter|item|energy|weakness|resistance|retreat|illustrator|ability|pokemon|evolves|rule|damage|draw|attack)/i.test(line));
 return {queries:[...new Set(queries)].slice(0,3),number,lines};
}
async function apiSearch(query,number="",signal){
 const params=new URLSearchParams({"pagination:page":"1","pagination:itemsPerPage":"200"});
 if(query)params.set("name",query);
 if(number)params.set("localId","eq:"+number);
 const response=await fetch(API+"/cards?"+params.toString(),{signal});
 if(!response.ok)throw Error("Card search returned "+response.status);
 const list=await response.json();
 if(!Array.isArray(list))throw Error("Card search returned an invalid response");
 return list;
}
function score(card,query,number){
 const name=normalize(card.name),target=normalize(query);
 return (name===target?100:name.includes(target)?60:target.includes(name)?40:0)+
  (number&&localNum(card.localId)===localNum(number)?140:0);
}
async function findMatches(queries,number,signal){
 const found=new Map();let succeeded=0,failed=0;
 for(const query of queries.slice(0,3)){
  try{
   const list=await apiSearch(query,"",signal);succeeded++;
   for(const card of list)found.set(card.id,card);
  }catch(error){if(error.name==="AbortError")throw error;failed++}
 }
 if(!found.size&&number){
  try{
   const list=await apiSearch("",number,signal);succeeded++;
   for(const card of list)found.set(card.id,card);
  }catch(error){if(error.name==="AbortError")throw error;failed++}
 }
 if(!succeeded&&failed)throw Error("Card lookup is unavailable. Check your connection and retry.");
 return [...found.values()].sort((a,b)=>score(b,queries[0]||"",number)-score(a,queries[0]||"",number)).slice(0,12);
}
function current(operation){return operation===S.operation&&!document.hidden}
function beginLookup(){
 S.abort?.abort();
 S.abort=typeof AbortController==="function"?new AbortController():null;
 return ++S.operation;
}
function textRegion(canvas,region,enhance=false){
 const [left,top,width,height]=region.map((value,i)=>value*(i%2?canvas.height:canvas.width));
 const output=cropCanvas(),scale=1560/width;
 output.width=1560;output.height=Math.round(height*scale);
 const ctx=output.getContext("2d",{willReadFrequently:enhance});
 ctx.drawImage(canvas,left,top,width,height,0,0,output.width,output.height);
 if(enhance){
  const image=ctx.getImageData(0,0,output.width,output.height),data=image.data;
  const levels=new Uint8Array(data.length/4);
  for(let i=0,j=0;i<data.length;i+=4,j++)levels[j]=Math.round(data[i]*.299+data[i+1]*.587+data[i+2]*.114);
  const histogram=new Uint32Array(256);
  for(const value of levels)histogram[value]++;
  let low=0,high=255,count=0;
  while(low<254&&(count+=histogram[low])<levels.length*.01)low++;
  count=0;while(high>low+1&&(count+=histogram[high])<levels.length*.01)high--;
  for(let i=0,j=0;i<data.length;i+=4,j++){
   const value=Math.max(0,Math.min(255,((levels[j]-low)*255/(high-low)-128)*1.5+128));
   data[i]=data[i+1]=data[i+2]=value;
  }
  ctx.putImageData(image,0,0);
 }
 return output;
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
 const query=String(raw||"").trim(),number=String(document.getElementById("psc-number")?.value||"").split("/")[0].trim();
 if(!query&&!number)return state("Type a card name or collector number.","error");
 const operation=beginLookup();
 state("Looking up matching cards…");
 try{
  const matches=await findMatches(query?[query]:[],number,S.abort?.signal);
  if(!current(operation))return;
  printMatches(matches,"Search: "+query+(number?" · #"+number:""));
  state(matches.length?matches.length+" possible matches. Confirm the exact printing before adding.":"No matching cards. Check the name and collector number.",matches.length?"":"error");
 }catch(error){if(current(operation))state(error.message,"error")}
}
async function manual(){return search(document.getElementById("psc-manual")?.value)}
async function recognize(canvas){
 if(S.scanning)return;
 S.scanning=true;
 const operation=beginLookup();
 state("Reading card name and collector number…");
 try{
  const worker=await getWorker();
  if(!current(operation))return;
  await worker.setParameters({tessedit_pageseg_mode:"11",tessedit_char_whitelist:"",tessjs_create_hocr:"0",tessjs_create_tsv:"0"});
  const header=[0,0,1,.21],footer=[0,.78,1,.22];
  const plain=await worker.recognize(textRegion(canvas,header),{},{text:true});
  if(!current(operation))return;
  const enhanced=await worker.recognize(textRegion(canvas,header,true),{},{text:true});
  if(!current(operation))return;
  const foot=await worker.recognize(textRegion(canvas,footer,true),{},{text:true});
  if(!current(operation))return;
  let nameText=[plain.data?.text,enhanced.data?.text].join("\n");
  let parsed=parseText(nameText+"\n"+(foot.data?.text||""));
  let names=[];
  try{names=await getNames()}catch{}
  if(!current(operation))return;
  let queries=nameQueries(nameText,names);
  if(!queries.length){
   const full=await worker.recognize(canvas,{},{text:true});
   if(!current(operation))return;
   nameText+="\n"+(full.data?.text||"");
   parsed=parseText(nameText+"\n"+(foot.data?.text||""));
   queries=nameQueries(nameText,names);
  }
  S.lastText=nameText;
  if(!queries.length)queries=parsed.queries;
  if(!queries.length&&!parsed.number){
   printMatches([]);
   state("The name and number are unclear. Hold the card steady, reduce glare, or enter them below.","error");
   return;
  }
  const nameInput=document.getElementById("psc-manual"),numberInput=document.getElementById("psc-number");
  if(nameInput)nameInput.value=queries[0]||"";
  if(numberInput)numberInput.value=parsed.number;
  state("Looking for "+(queries[0]||"#"+parsed.number)+"…");
  const matches=await findMatches(queries,parsed.number,S.abort?.signal);
  if(!current(operation))return;
  printMatches(matches,(queries[0]||"Collector number")+(parsed.number?" · #"+parsed.number:""));
  if(matches.length&&S.auto)auto();
  state(matches.length?"Possible matches found. Confirm the set and number before adding.":
    "No matching cards. Correct the detected name or number below and tap Find card.",matches.length?"":"error");
 }catch(error){if(current(operation))state("Scan could not finish: "+error.message,"error")}
 finally{S.scanning=false}
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
function clear(){S.operation++;S.abort?.abort();S.candidates=[];printMatches([]);state("Results cleared.");}
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
window.PokeScanner={parseText,nameQueries,findMatches,textRegion,recognize,frameArea,render,start,capture,auto,stop,upload,search:manual,clear,add,card:id=>S.candidates.find(c=>c.id===id)};
window.pscStart=start;window.pscCapture=capture;window.pscAuto=auto;window.pscStop=()=>{stop();state("Camera stopped.")};window.pscUpload=upload;window.pscSearch=manual;window.pscClear=clear;window.pscAdd=add;
})();