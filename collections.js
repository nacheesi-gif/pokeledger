(function(){
"use strict";
const E=t=>String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let selected="";
function ensure(){if(!Array.isArray(db.binders))db.binders=[];for(const b of db.binders){if(!Array.isArray(b.cards))b.cards=[]}return db.binders}
function isOwned(id){const o=db.statuses?.[id];return !!(o&&["Owned","Grading"].includes(o.state)&&Number(o.qty||1)>0)}
function list(){return ensure()}
function binderOptions(){return '<option value="">No specific binder</option>'+ensure().map(b=>'<option value="'+E(b.id)+'">'+E(b.name)+'</option>').join("")}
function filtered(cards){if(!selected)return cards;const b=ensure().find(x=>x.id===selected);return b?cards.filter(c=>b.cards.includes(c.id)):cards}
function assigned(id){return ensure().filter(b=>b.cards.includes(id))}
function select(id){selected=id;render()}
function overview(){
 const records=ensure();
 return '<div class="panel"><div class="panelTitle"><h2>My Custom Collections</h2><button class="btn sm primary" onclick="pkNewBinder()">+ New collection</button></div><p class="mutedLine">Create binders for artists, Eeveelutions, favorites, each child, or anything else. A card can appear in multiple collections without duplicating its ownership or price.</p><div class="pk-binders"><button class="pk-binder '+(!selected?"chosen":"")+'" onclick="pkSelectBinder(\\'\\')"><b>All owned cards</b><small>'+ownedCards().length+' unique card entries</small></button>'+records.map(b=>'<button class="pk-binder '+(selected===b.id?"chosen":"")+'" onclick="pkSelectBinder(\\''+E(b.id)+'\\')"><b>'+E(b.name)+'</b><small>'+b.cards.filter(isOwned).length+' cards</small></button>').join("")+'</div>'+(selected?'<div class="pk-binderactions"><button class="btn sm" onclick="pkRenameBinder()">Rename collection</button><button class="btn sm danger" onclick="pkDeleteBinder()">Delete collection</button></div>':"")+'</div>';
}
function create(){const name=prompt("Name your new collection, e.g. Komiya Art Binder:");if(!name)return;const t=name.trim().slice(0,60);if(!t)return;if(ensure().some(x=>x.name.toLowerCase()===t.toLowerCase())){alert("A collection already uses this name.");return}const id="binder-"+uid();ensure().push({id,name:t,cards:[]});selected=id;save()}
function rename(){const b=ensure().find(x=>x.id===selected);if(!b)return;const name=prompt("Rename this collection:",b.name);if(!name)return;const t=name.trim().slice(0,60);if(!t)return;b.name=t;save()}
function deleteBinder(){const b=ensure().find(x=>x.id===selected);if(!b)return;if(!confirm('Delete collection "'+b.name+'"? Your cards and transaction records will be kept.'))return;db.binders=db.binders.filter(x=>x.id!==selected);selected="";save()}
function assign(cardId,binderId,shouldSave=true){if(!binderId)return;const b=ensure().find(x=>x.id===binderId);if(!b)return;if(!b.cards.includes(cardId))b.cards.push(cardId);if(shouldSave)save()}
function unassign(cardId,binderId){const b=ensure().find(x=>x.id===binderId);if(!b)return;b.cards=b.cards.filter(x=>x!==cardId);save()}
function openAssign(cardId){
 const card=getCard(cardId);if(!card)return;const binders=ensure();
 if(!binders.length){show('<h2>Organize '+E(card.name)+'</h2><p class="mutedLine">Create your first custom collection to organize this card. It will still appear in My Collection.</p><div class="modalFoot"><button class="btn" onclick="closeModal()">Close</button><button class="btn primary" onclick="closeModal();pkNewBinder()">New collection</button></div>');return}
 show('<h2>Add '+E(card.name)+' to collections</h2><p class="mutedLine">Choose any number of your custom collections. One card can be in many binders without multiplying your inventory.</p><form onsubmit="event.preventDefault();pkSubmitAssignment(this,\\''+E(cardId)+'\\')">'+binders.map(b=>'<label class="pk-check"><input type="checkbox" name="binders" value="'+E(b.id)+'" '+(b.cards.includes(cardId)?"checked":"")+'><span>'+E(b.name)+'</span></label>').join("")+'<div class="modalFoot"><button class="btn" type="button" onclick="closeModal()">Cancel</button><button class="btn primary" type="submit">Save collections</button></div></form>');
}
function submitAssignment(f,id){
 const chosen=new Set(new FormData(f).getAll("binders"));
 for(const b of ensure()){if(chosen.has(b.id)){if(!b.cards.includes(id))b.cards.push(id)}else b.cards=b.cards.filter(x=>x!==id)}
 closeModal();save();
}
function renameMember(old){
 if(!db.members.includes(old))return;
 const name=prompt("New family profile name:",old);if(name===null)return;
 const newer=name.trim().slice(0,45);if(!newer||newer===old)return;
 if(db.members.some(m=>m.toLowerCase()===newer.toLowerCase()))return alert("Another profile already has that name.");
 db.members=db.members.map(m=>m===old?newer:m);
 for(const t of db.transactions){if(t.owner===old)t.owner=newer}
 for(const s of Object.values(db.statuses||{})){if(s.owner===old)s.owner=newer}
 for(const b of ensure()){if(b.owner===old)b.owner=newer}
 save();
}
function settingsPanel(){return '<div class="panel"><div class="panelTitle"><h2>Family Profile Names</h2><button class="btn sm" onclick="addMember()">+ Add member</button></div><p class="mutedLine">Rename the kids and family profiles whenever you like. Past purchases and owned cards will follow the renamed profile.</p>'+db.members.map(m=>'<div class="row pk-member"><span>'+E(m)+'</span><button class="btn sm" onclick="pkRenameMember(\\''+E(m).replaceAll("'","&#39;")+'\\')">Edit label</button></div>').join("")+'</div>'}
const style='<style id="pk-collection-style">.pk-binders{display:flex;gap:9px;overflow-x:auto;padding-bottom:6px}.pk-binder{background:#f8fbff;border:1px solid #cbdff7;color:#285da3;border-radius:12px;padding:12px 14px;min-width:142px;max-width:220px;flex:0 0 auto;text-align:left}.pk-binder.chosen{background:#e7f2ff;border:2px solid #2770cc}.pk-binder b{display:block}.pk-binder small{font-size:11px;display:block;color:#6e809a}.pk-binderactions{display:flex;gap:8px;margin-top:13px}.pk-check{display:flex;align-items:center;gap:10px;border:1px solid #dce9f7;border-radius:12px;padding:14px;margin:7px 0;font-weight:750}.pk-check input{width:19px;height:19px}.pk-member{border-bottom:1px solid #ebf0f7;padding:11px 0}</style>';
document.head.insertAdjacentHTML("beforeend",style);
window.PokeCollections={ensure,list,overview,filtered,assign,assigned,openAssign,binderOptions,settingsPanel,renameMember};
window.pkSelectBinder=select;window.pkNewBinder=create;window.pkRenameBinder=rename;window.pkDeleteBinder=deleteBinder;window.pkAssignCard=openAssign;window.pkSubmitAssignment=submitAssignment;window.pkRenameMember=renameMember;
})();