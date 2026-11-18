(function () {
'use strict';
const E = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validID = x => typeof x === 'string' && /^[a-zA-Z0-9.+-]{1,80}$/.test(x);
const results = new WeakMap(), searches = new Map();
let controller = null;
function clean(value) {
  if (!value || !validID(value.id) || typeof value.name !== 'string' || !value.name.trim()) return null;
  if (typeof value.image !== 'string' || !/^https:\/\/assets\.tcgdex\.net\/(en|ja)\/[a-zA-Z0-9.+_-]+\/[a-zA-Z0-9.+_-]+\/[a-zA-Z0-9.+_-]+$/.test(value.image)) return null;
  return {id:value.id, name:value.name.slice(0,120), image:value.image,
    number:String(value.number ?? value.localId ?? '').slice(0,30),
    setId:String(value.setId || value.id.slice(0,value.id.lastIndexOf('-'))).slice(0,60)};
}
function grade(text) {
  text = String(text || '').trim();
  if (/\b(raw|ungraded|candidate|potential|not|fake)\b|\?/.test(text.toLowerCase())) return null;
  const companies = text.match(/\b(?:psa|cgc)(?=\s|\d|[:.-]|$)/gi) || [];
  if (companies.length !== 1) return null;
  const found = text.match(/\b(psa|cgc)[\s:-]*(?:(pristine|pristien|gem\s*mint|mint|perfect)\s*)?(10|[1-9](?:\.5)?)(?![\d.])\b/i);
  if (!found) return null;
  const company = found[1].toLowerCase(), quality = (found[2] || '').toLowerCase();
  if (company === 'psa' && quality && !['mint','gem mint','gemmint'].includes(quality)) return null;
  if (company === 'cgc' && /pristine|pristien|perfect/.test(quality) && found[3] !== '10') return null;
  const qualifier = /pristine|pristien/.test(quality) ? 'Pristine ' : quality === 'perfect' ? 'Perfect ' : /gem/.test(quality) ? 'Gem Mint ' : '';
  return {company, label:company.toUpperCase()+' '+qualifier+found[3], value:qualifier+found[3]};
}
function badge(text) {
  const g = grade(text);
  return g ? '<span class="art-grade '+g.company+'" title="'+E(g.label)+' · from your label, not certification verification"><img src="./'+g.company+'-logo.svg" alt="'+g.company.toUpperCase()+'" width="42" height="18"><b>'+E(g.value)+'</b></span>' : '';
}
function image(card, high = false) {
  return '<img class="art-card" src="'+E(card.image+(high?'/high.webp':'/low.webp'))+'" alt="'+E(card.name)+'" width="245" height="337" decoding="async" loading="'+(high?'eager':'lazy')+'" referrerpolicy="no-referrer" onerror="PokeArtwork.imageFailed(this)">';
}
function imageFailed(img) {
  if (img.dataset.fallback) {img.hidden = true;return;}
  img.dataset.fallback = 'yes';
  img.src = './card-placeholder.svg';
  img.alt = 'Artwork unavailable. Your purchase is saved.';
}
function thumb(transaction) {
  const card = clean(transaction.artwork);
  if (!card) return '';
  return '<button type="button" class="art-thumb" aria-label="View '+E(card.name)+' artwork" onclick="PokeArtwork.open('+E(JSON.stringify(transaction.id))+')">'+image(card)+'</button>';
}
function selectedHTML(card) {
  return card ? '<div class="art-selected">'+image(card)+'<div><b>'+E(card.name)+'</b><small>'+E(card.setId+' · #'+card.number)+'</small><button type="button" class="text-button" onclick="PokeArtwork.remove(this)">Remove image</button></div></div>' : '<p class="ledger-help">No card image attached. This is optional.</p>';
}
function editor(value) {
  const card = clean(value);
  return '<details class="art-editor"><summary>Card image · '+(card?'attached':'optional')+'</summary><input type="hidden" name="artwork" value="'+E(JSON.stringify(card))+'"><div class="art-selection">'+selectedHTML(card)+'</div><p class="ledger-help">Choose the exact printing once. The image stays with this purchase.</p><div class="formGrid"><label>Card name<input class="field art-query" placeholder="Charizard" maxlength="80"></label><label>Card number <small>Optional</small><input class="field art-number" placeholder="4 or TG01" maxlength="20"></label><label>Language<select class="field art-language"><option value="en">English</option><option value="ja">Japanese</option></select></label></div><button type="button" class="btn" onclick="PokeArtwork.search(this,1)">Find artwork</button><p class="art-status ledger-help" role="status"></p><div class="art-results"></div></details>';
}
function read(form) {
  const input = form.elements.artwork;
  if (!input) return undefined;
  try {return clean(JSON.parse(input.value));} catch {throw Error('Please choose the card image again.');}
}
function remove(button) {
  const root = button.closest('.art-editor');
  root.querySelector('[name=artwork]').value = 'null';
  root.querySelector('.art-selection').innerHTML = selectedHTML(null);
  root.querySelector('summary').textContent = 'Card image · optional';
}
function choose(button, index) {
  const root = button.closest('.art-editor'), card = results.get(root)?.[index];
  if (!card) return;
  root.querySelector('[name=artwork]').value = JSON.stringify(card);
  root.querySelector('.art-selection').innerHTML = selectedHTML(card);
  root.querySelector('summary').textContent = 'Card image · attached';
  root.querySelector('.art-results').innerHTML = '';
  root.querySelector('.art-status').textContent = 'Image selected. Save purchase to keep it.';
}
function searchURL(name, number, language, page) {
  if (!['en','ja'].includes(language) || !Number.isInteger(page) || page<1 || page>100) throw Error('Choose a valid search page.');
  name = String(name||'').trim(); number = String(number||'').trim();
  if (name.length<2 || name.length>80 || number.length>20) throw Error('Enter at least two characters of the card name.');
  const params = new URLSearchParams({name:'like:'+name,'pagination:page':String(page),'pagination:itemsPerPage':'12'});
  if (number) params.set('localId',number);
  return 'https://api.tcgdex.net/v2/'+language+'/cards?'+params;
}
async function search(button, page) {
  const root = button.closest('.art-editor'), status = root.querySelector('.art-status'), output = root.querySelector('.art-results');
  controller?.abort(); const active = controller = new AbortController();
  let timer;
  try {
    const name = root.querySelector('.art-query').value.trim(), number = root.querySelector('.art-number').value.trim(), language = root.querySelector('.art-language').value;
    const url = searchURL(name,number,language,page);
    status.textContent = 'Finding artwork…'; output.innerHTML = '';
    let payload = searches.get(url);
    if (!payload) {
      timer = setTimeout(()=>active.abort(),12000);
      const response = await fetch(url,{signal:active.signal,referrerPolicy:'no-referrer'});
      if (!response.ok) throw Error('Card search is unavailable. Try again when online.');
      const data = await response.json();
      if (!Array.isArray(data)) throw Error('Card search returned an unexpected response.');
      payload = {cards:data.slice(0,12).map(clean).filter(Boolean),more:data.length>=12};
      searches.set(url,payload);if(searches.size>20)searches.delete(searches.keys().next().value);
    }
    if (active!==controller || !root.isConnected) return;
    results.set(root,payload.cards);
    status.textContent = payload.cards.length ? 'Choose by artwork, set code and number. Page '+page+'.' : 'No artwork on this page. Try a different name, number or the next page.';
    output.innerHTML = '<div class="art-grid">'+payload.cards.map((card,i)=>'<button type="button" class="art-result" onclick="PokeArtwork.choose(this,'+i+')">'+image(card)+'<b>'+E(card.name)+'</b><small>'+E(card.setId+' · #'+card.number)+'</small></button>').join('')+'</div><div class="art-pages">'+(page>1?'<button type="button" class="btn" onclick="PokeArtwork.search(this,'+(page-1)+')">Previous</button>':'')+(payload.more?'<button type="button" class="btn" onclick="PokeArtwork.search(this,'+(page+1)+')">Next</button>':'')+'</div>';
  } catch(error) {
    if (active!==controller || !root.isConnected) return;
    // Previously selected cards remain available even if the catalog is offline.
    const name = root.querySelector('.art-query').value.trim().toLowerCase();
    const saved = [...new Map(db.transactions.map(t=>clean(t.artwork)).filter(c=>c&&c.name.toLowerCase().includes(name)).map(c=>[c.id,c])).values()].slice(0,12);
    results.set(root,saved);
    status.textContent = (error.name==='AbortError'?'Search timed out. Try again.':error.message)+(saved.length?' Saved matches on this phone:':' You can save the purchase without an image.');
    output.innerHTML = '<div class="art-grid">'+saved.map((card,i)=>'<button type="button" class="art-result" onclick="PokeArtwork.choose(this,'+i+')">'+image(card)+'<b>'+E(card.name)+'</b><small>'+E(card.setId+' · #'+card.number)+'</small></button>').join('')+'</div>';
  } finally {clearTimeout(timer);}
}
function open(id) {
  const row = db.transactions.find(t=>t.id===id), card = clean(row?.artwork);
  if (!card) return;
  show('<div class="art-viewer" role="dialog" aria-label="Card artwork"><h2>'+E(card.name)+'</h2>'+badge(row.type)+'<p class="ledger-help">'+E(card.setId+' · #'+card.number)+' · Catalog artwork</p><div class="art-zoom" tabindex="0">'+image(card,true)+'</div><p class="ledger-help">'+(grade(row.type)?'Grade comes from your custom label. ':'')+'Zoom in, then swipe or scroll to inspect the card.</p><div class="modalFoot"><button class="btn" onclick="PokeArtwork.zoom(this)">Zoom in</button><button class="btn" onclick="LedgerUI.details('+E(JSON.stringify(id))+')">Purchase details</button><button class="btn primary" onclick="closeModal()">Close</button></div></div>');
  document.querySelector('.art-viewer .btn')?.focus();
}
function zoom(button) {
  const area = button.closest('.art-viewer').querySelector('.art-zoom');
  const on = area.classList.toggle('enlarged');button.textContent = on?'Fit card':'Zoom in';
}
function cancel() {controller?.abort();controller=null;}
if (typeof document!=='undefined') {
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape' && document.querySelector('.art-viewer'))closeModal();});
}
window.PokeArtwork={clean,grade,badge,thumb,editor,read,remove,choose,search,searchURL,open,zoom,imageFailed,cancel};
})();
