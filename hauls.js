(function(){
"use strict";
const E=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cents=n=>Math.round((Number(n)||0)*100);
const price=n=>'$'+(Number(n)/100).toFixed(2);
let counter=0;
function row(){
 const id=++counter;
 return '<div class="haul-line" data-haul-row="'+id+'"><div class="haul-line-top"><b>Card '+id+'</b><button class="btn sm danger" type="button" onclick="pkHaulRemove(this)">Remove</button></div>'+
 '<div class="haul-columns">'+
 '<label class="span2">Card name<input class="field" name="cardName" placeholder="Eevee, Flareon ex…" required></label>'+
 '<label class="span2">Or use an existing catalog card<select class="field" name="cardRef" onchange="pkHaulSelect(this)"><option value="">Enter card details manually</option>'+allCards().map(c=>'<option value="'+E(c.id)+'">'+E(c.name)+' — '+E(c.set||'Unknown set')+' '+E(c.number||'')+'</option>').join('')+'</select></label>'+
 '<label>Set<input class="field" name="set" placeholder="e.g. Paldea Evolved"></label>'+
 '<label>Card number<input class="field" name="number" placeholder="e.g. 198/193"></label>'+
 '<label>Quantity<input class="field" name="qty" type="number" min="1" max="999" value="1" step="1" required oninput="pkHaulCalc()"></label>'+
 '<label>Cost paid per card ($)<input class="field" name="unitCost" type="number" min="0" step="0.01" placeholder="0.00 if free" required oninput="pkHaulCalc()"></label>'+
 '<label>Market value per card ($)<input class="field" name="marketValue" type="number" min="0" step="0.01" placeholder="Optional" oninput="pkHaulCalc()"></label>'+
 '<label>Condition<select class="field" name="condition"><option>NM</option><option>LP</option><option>MP</option><option>HP</option><option>DMG</option><option>PSA 9</option><option>PSA 10</option><option>Graded other</option><option>Unknown</option></select></label>'+
 '</div><small class="haul-line-sum">Enter card cost and quantity</small></div>';
}
function form(){
 counter=0;
 return '<h2>Log a haul · Card by card</h2><p class="mutedLine">Add each card and how much you paid for it. PokéLedger will total their costs and use their individual values on the dashboard. No need to calculate cost basis manually.</p>'+
 '<form id="pk-haul-form" onsubmit="event.preventDefault();pkHaulSubmit(this)">'+
 '<div class="formGrid"><label class="span2">Haul description<input class="field" name="title" required placeholder="LastPack haul, Whatnot mail day…"></label>'+
 '<label>Total amount paid ($)<input class="field" type="number" name="amount" min="0" step="0.01" required oninput="pkHaulCalc()"></label>'+
 '<label>Date<input class="field" name="date" type="date" value="'+today()+'" required></label>'+
 '<label>Purpose<select class="field" name="purpose">'+opts(purposes,'Hobby / family')+'</select></label>'+
 '<label>Owner<select class="field" name="owner">'+opts(db.members,'Me')+'</select></label>'+
 '<label>Purchase type<select class="field" name="type">'+opts(types,'Singles')+'</select></label>'+
 '<label>Where from?<input class="field" name="merchant" placeholder="LastPack, Whatnot, store"></label>'+
 '<label class="span2">Receipt URL<input class="field" name="receipt" type="url" placeholder="Optional"></label></div>'+
 '<div class="haul-section-title"><h3>Cards in this haul</h3><button class="btn sm primary" type="button" onclick="pkHaulAdd()">+ Add another card</button></div>'+
 '<div id="pk-haul-rows">'+row()+'</div>'+
 '<div class="haul-calculator"><div><span>Card costs entered</span><b id="pk-haul-total">$0.00</b></div><div><span>Haul amount</span><b id="pk-haul-paid">—</b></div><div><span>Difference to allocate</span><b id="pk-haul-diff">—</b></div><p id="pk-haul-help">Assign the full haul expense to your cards. Include any tax, shipping or fees in the per-card cost amounts.</p></div>'+
 '<label class="span2">Notes<textarea class="field" name="notes" rows="2" placeholder="Shipping, fees, versions, haul details"></textarea></label>'+
 '<div class="modalFoot"><button class="btn" type="button" onclick="closeModal()">Cancel</button><button class="btn primary" type="submit">Save haul & cards</button></div></form>';
}
function open(){show(form());recalc()}
function addRow(){document.getElementById("pk-haul-rows")?.insertAdjacentHTML("beforeend",row());recalc()}
function removeRow(button){const rows=document.querySelectorAll(".haul-line");if(rows.length<=1)return alert("Keep at least one card row.");button.closest(".haul-line")?.remove();recalc()}
function select(el){const c=getCard(el.value);const r=el.closest(".haul-line");if(c&&r){r.querySelector('[name="cardName"]').value=c.name;r.querySelector('[name="set"]').value=c.set||"";r.querySelector('[name="number"]').value=c.number||"";}recalc()}
function lines(f){
 return [...f.querySelectorAll(".haul-line")].map(r=>{const obj={};for(const key of ["cardName","cardRef","set","number","qty","unitCost","marketValue","condition"]){obj[key]=r.querySelector('[name="'+key+'"]')?.value??"";}return obj});
}
function totals(formEl){
 const entries=lines(formEl);
 const lineTotal=entries.reduce((a,r)=>a+cents(r.unitCost)*Number(r.qty||0),0);
 const field=formEl.querySelector('[name="amount"]')?.value;
 return {lineTotal,paid:field===""?null:cents(field),entries};
}
function recalc(){const f=document.getElementById("pk-haul-form");if(!f)return;const {lineTotal,paid,entries}=totals(f);
 const node=id=>document.getElementById(id);
 if(node("pk-haul-total"))node("pk-haul-total").textContent=price(lineTotal);
 if(node("pk-haul-paid"))node("pk-haul-paid").textContent=paid===null?"—":price(paid);
 if(node("pk-haul-diff"))node("pk-haul-diff").textContent=paid===null?"—":price(paid-lineTotal);
 if(node("pk-haul-help"))node("pk-haul-help").textContent=paid===null?"Enter the haul total, then allocate the costs across the cards.":Math.abs(paid-lineTotal)<=1?"✓ Haul costs accounted for.":"Assign the remaining "+price(Math.abs(paid-lineTotal))+" difference across card costs, including tax or shipping.";
 [...f.querySelectorAll(".haul-line")].forEach((r,i)=>{const el=r.querySelector(".haul-line-sum");if(el)el.textContent="Line "+(i+1)+": "+price(cents(entries[i].unitCost)*Number(entries[i].qty||0))+" paid"+(entries[i].marketValue!==""?" · "+price(cents(entries[i].marketValue)*Number(entries[i].qty||0))+" estimated market value":" · no market value yet")});
}
function submit(formEl){
 const fields=Object.fromEntries(new FormData(formEl));const {lineTotal,paid,entries}=totals(formEl);
 if(paid===null||!Number.isSafeInteger(paid)||paid<0)return alert("Enter a valid haul amount.");
 if(!entries.length)return alert("Add at least one card.");
 if(Math.abs(paid-lineTotal)>1)return alert("Card costs must equal the haul total. Allocate the difference to each card, including shipping and fees.");
 const prepared=[];
 for(let i=0;i<entries.length;i++){
   const raw=entries[i],qty=Number(raw.qty),unitCost=Number(raw.unitCost);
   if(!raw.cardName.trim()||!Number.isInteger(qty)||qty<1||qty>999||raw.unitCost===""||!Number.isFinite(unitCost)||unitCost<0)return alert("Check name, quantity, and cost on card "+(i+1));
   let mv=null;if(raw.marketValue!==""){mv=Number(raw.marketValue);if(!Number.isFinite(mv)||mv<0)return alert("Check market value on card "+(i+1))}
   // When the same printing is purchased at a different price, recompute per-copy average from the owned inventory.
   const selected=raw.cardRef?getCard(raw.cardRef):null;
   prepared.push({name:raw.cardName.trim(),set:raw.set.trim(),number:raw.number.trim(),selected,qty,unitCost,mv,condition:raw.condition});
 }
 const haulId=uid(),cards=[],recordDate=fields.date||today();
 for(const line of prepared){
   let c=line.selected;
   // Only match a manually typed card if its name, set and number all match an existing record.
   if(!c&&line.set&&line.number)c=allCards().find(z=>z.name.toLowerCase()===line.name.toLowerCase()&&String(z.set).toLowerCase()===line.set.toLowerCase()&&String(z.number).toLowerCase()===line.number.toLowerCase())||null;
   if(!c){c={id:"haul-"+uid(),name:line.name,set:line.set,number:line.number,category:"Other",image:"",rank:null,referencePrice:null};db.cards.push(c)}
   const old=db.statuses[c.id]||{},oldQty=["Owned","Grading"].includes(old.state)?Math.max(0,Number(old.qty)||0):0;
   const oldCost=old.unitCost===null||old.unitCost===undefined||old.unitCost===""?null:Number(old.unitCost);
   const newQty=oldQty+line.qty;
   const blended=oldQty?(oldCost!==null&&Number.isFinite(oldCost)&&oldCost>=0?(oldCost*oldQty+line.unitCost*line.qty)/newQty:null):line.unitCost;
   db.statuses[c.id]={...old,state:"Owned",owner:fields.owner,qty:newQty,unitCost:blended===null?null:Math.round(blended*10000)/10000,condition:line.condition,marketUnitValue:line.mv===null?(old.marketUnitValue??null):line.mv,marketAsOf:line.mv===null?(old.marketAsOf??""):recordDate,marketSource:line.mv===null?(old.marketSource??""):"User-entered haul estimate"};
   cards.push({cardId:c.id,name:c.name,set:c.set,number:c.number,qty:line.qty,unitCost:line.unitCost,marketUnitValue:line.mv,condition:line.condition});
 }
 db.transactions.push({id:haulId,kind:"purchase",title:fields.title,date:recordDate,amount:paid/100,owner:fields.owner,merchant:fields.merchant||"",purpose:fields.purpose||"Hobby / family",type:fields.type||"Singles",receipt:fields.receipt||"",notes:fields.notes||"",haulCards:cards});
 closeModal();save();
 alert(cards.length+" card entries saved in My Collection. Total haul: "+price(paid)+".");
}
const style='<style id="pk-hauls-css">.haul-section-title,.haul-line-top{display:flex;justify-content:space-between;align-items:center;gap:12px}.haul-section-title{margin:18px 0 10px}.haul-line{background:#f7fbff;border:1px solid #d6e4f5;border-radius:13px;padding:12px;margin-bottom:10px}.haul-line-top{margin-bottom:8px}.haul-line-top b{font-size:13px;color:#265fa8}.haul-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.haul-columns label{font-size:11px;display:flex;flex-direction:column;gap:4px;font-weight:750}.haul-line-sum{font-size:11px;color:#5379a7;display:block;margin-top:8px}.haul-calculator{background:#eff7ff;border:1px solid #cde2fa;border-radius:13px;padding:14px;margin:14px 0}.haul-calculator div{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}.haul-calculator p{font-size:11px;color:#536e8d;margin:9px 0 0}.haul-calculator b{font-variant-numeric:tabular-nums}.modal:has(#pk-haul-form){max-width:700px}@media(max-width:520px){.haul-columns{grid-template-columns:1fr}.haul-columns .span2{grid-column:span 1}}</style>';
document.head.insertAdjacentHTML("beforeend",style);
window.PokeHauls={open,addRow,removeRow,select,recalc,submit,totals};
window.pkHaulAdd=addRow;window.pkHaulRemove=removeRow;window.pkHaulSelect=select;window.pkHaulCalc=recalc;window.pkHaulSubmit=submit;
})();