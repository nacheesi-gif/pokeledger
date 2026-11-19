(function () {
"use strict";
const PERSONAL = "Hobby / family";
const RESALE = "Resale inventory";
const VIEW_KEY = "pokeledger-spending-view-v1";
const E = value => String(value ?? "").replace(/[&<>"']/g, character =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
let view = null;
let writeError = "";

function preferences() {
  if (view) return view;
  try { view = JSON.parse(localStorage.getItem(VIEW_KEY)); } catch {}
  view = {page:"dashboard", scope:"month", month:new Date().toLocaleDateString("en-CA").slice(0,7), profile:"all", ...(view || {})};
  return view;
}
function remember() {
  try { localStorage.setItem(VIEW_KEY, JSON.stringify(preferences())); } catch {}
}
function startPage() {
  const candidate = preferences().page;
  return ["dashboard","spending","sales","settings"].includes(candidate) ? candidate : "dashboard";
}
function rememberPage(next) { preferences().page = next; remember(); }
function hasStarted() {
  try { return localStorage.getItem(KEY) !== null; } catch { return false; }
}
function previousData() {
  try { return localStorage.getItem(LEGACY_KEY); } catch { return null; }
}
function clone() { return JSON.parse(JSON.stringify(db)); }
function write(next) {
  const before = db;
  try {
    validateSnapshot(next);
    db = next;
    persist();
    writeError = "";
  } catch (error) {
    db = before;
    writeError = error.message;
    alert("Your change could not be saved on this phone. " + error.message);
    return false;
  }
  render();
  scheduleCloudSave();
  return true;
}
function begin() {
  const original = previousData();
  if (original) download("pokeledger-previous-backup.json", original, "application/json");
  if (write(initial())) nav("dashboard");
}
function exportPrevious() {
  const original = previousData();
  if (original) download("pokeledger-previous-backup.json", original, "application/json");
}
function cents(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw Error("Enter an amount with up to two decimal places.");
  const amount = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(amount)) throw Error("That amount is too large.");
  return amount;
}
function buildReceipt(fields, allocations) {
  const total = cents(fields.amount);
  if (!String(fields.title || "").trim()) throw Error("Enter what you bought.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date || "")) throw Error("Choose the purchase date.");
  const purchaseType = String(fields.type || "").trim();
  if (purchaseType.length > 60) throw Error("Keep the purchase type to 60 characters or fewer.");
  if (purchaseType.toLowerCase() === "giveaway" && total !== 0) throw Error("Giveaways have a $0 acquisition cost.");
  const parts = allocations.map(part => {
    if (!db.members.includes(part.owner)) throw Error("Choose an existing profile.");
    if (![PERSONAL, RESALE].includes(part.purpose)) throw Error("Choose a spending purpose.");
    return {owner:part.owner, purpose:part.purpose, amount:cents(part.amount) / 100};
  });
  if (!parts.length || parts.reduce((sum, part) => sum + Math.round(part.amount * 100), 0) !== total) {
    throw Error("The split amounts must equal the receipt total.");
  }
  return {
    id:uid(), kind:"purchase", title:fields.title.trim(), date:fields.date, amount:total / 100,
    owner:parts.length === 1 ? parts[0].owner : "Shared",
    purpose:parts.every(part => part.purpose === RESALE) ? RESALE : parts.every(part => part.purpose === PERSONAL) ? PERSONAL : "Mixed",
    allocations:parts, merchant:String(fields.merchant || "").trim(),
    type:purchaseType, notes:String(fields.notes || "").trim(),
    receipt:String(fields.receipt || "").trim()
  };
}
function purchaseRows() { return db.transactions.filter(transaction => transaction.kind === "purchase"); }
function inPeriod(transaction) {
  const settings = preferences();
  return settings.scope === "all" || transaction.date?.slice(0,7) === settings.month;
}
function amountFor(transaction, profile) {
  if (profile === "all") return Number(transaction.amount) || 0;
  if (profile === "resale") return expenseAmount(transaction, null, RESALE);
  return expenseAmount(transaction, profile.slice(7), PERSONAL);
}
function belongsTo(transaction, profile) {
  if (profile === "all") return true;
  return expenseParts(transaction).some(part => profile === "resale" ?
    part.purpose === RESALE : part.owner === profile.slice(7) && part.purpose === PERSONAL);
}
function selectedPurchases(profile = "all") {
  return purchaseRows().filter(transaction => inPeriod(transaction) && belongsTo(transaction, profile));
}
function sumRows(rows, profile = "all") {
  return rows.reduce((sum, transaction) => sum + Math.round(amountFor(transaction, profile) * 100), 0) / 100;
}
function call(method, argument) { return E("LedgerUI." + method + "(" + JSON.stringify(argument) + ")"); }
// Matching generation-iii icon atlas; provenance and build script in scripts/sync_sprites.py.
const SPRITE_NAMES = ["bulbasaur","ivysaur","venusaur","charmander","charmeleon","charizard","squirtle","wartortle","blastoise","caterpie","metapod","butterfree","weedle","kakuna","beedrill","pidgey","pidgeotto","pidgeot","rattata","raticate","spearow","fearow","ekans","arbok","pikachu","raichu","sandshrew","sandslash","nidoran-f","nidorina","nidoqueen","nidoran-m","nidorino","nidoking","clefairy","clefable","vulpix","ninetales","jigglypuff","wigglytuff","zubat","golbat","oddish","gloom","vileplume","paras","parasect","venonat","venomoth","diglett","dugtrio","meowth","persian","psyduck","golduck","mankey","primeape","growlithe","arcanine","poliwag","poliwhirl","poliwrath","abra","kadabra","alakazam","machop","machoke","machamp","bellsprout","weepinbell","victreebel","tentacool","tentacruel","geodude","graveler","golem","ponyta","rapidash","slowpoke","slowbro","magnemite","magneton","farfetchd","doduo","dodrio","seel","dewgong","grimer","muk","shellder","cloyster","gastly","haunter","gengar","onix","drowzee","hypno","krabby","kingler","voltorb","electrode","exeggcute","exeggutor","cubone","marowak","hitmonlee","hitmonchan","lickitung","koffing","weezing","rhyhorn","rhydon","chansey","tangela","kangaskhan","horsea","seadra","goldeen","seaking","staryu","starmie","mr-mime","scyther","jynx","electabuzz","magmar","pinsir","tauros","magikarp","gyarados","lapras","ditto","eevee","vaporeon","jolteon","flareon","porygon","omanyte","omastar","kabuto","kabutops","aerodactyl","snorlax","articuno","zapdos","moltres","dratini","dragonair","dragonite","mewtwo","mew","chikorita","bayleef","meganium","cyndaquil","quilava","typhlosion","totodile","croconaw","feraligatr","sentret","furret","hoothoot","noctowl","ledyba","ledian","spinarak","ariados","crobat","chinchou","lanturn","pichu","cleffa","igglybuff","togepi","togetic","natu","xatu","mareep","flaaffy","ampharos","bellossom","marill","azumarill","sudowoodo","politoed","hoppip","skiploom","jumpluff","aipom","sunkern","sunflora","yanma","wooper","quagsire","espeon","umbreon","murkrow","slowking","misdreavus","unown","wobbuffet","girafarig","pineco","forretress","dunsparce","gligar","steelix","snubbull","granbull","qwilfish","scizor","shuckle","heracross","sneasel","teddiursa","ursaring","slugma","magcargo","swinub","piloswine","corsola","remoraid","octillery","delibird","mantine","skarmory","houndour","houndoom","kingdra","phanpy","donphan","porygon2","stantler","smeargle","tyrogue","hitmontop","smoochum","elekid","magby","miltank","blissey","raikou","entei","suicune","larvitar","pupitar","tyranitar","lugia","ho-oh","celebi","treecko","grovyle","sceptile","torchic","combusken","blaziken","mudkip","marshtomp","swampert","poochyena","mightyena","zigzagoon","linoone","wurmple","silcoon","beautifly","cascoon","dustox","lotad","lombre","ludicolo","seedot","nuzleaf","shiftry","taillow","swellow","wingull","pelipper","ralts","kirlia","gardevoir","surskit","masquerain","shroomish","breloom","slakoth","vigoroth","slaking","nincada","ninjask","shedinja","whismur","loudred","exploud","makuhita","hariyama","azurill","nosepass","skitty","delcatty","sableye","mawile","aron","lairon","aggron","meditite","medicham","electrike","manectric","plusle","minun","volbeat","illumise","roselia","gulpin","swalot","carvanha","sharpedo","wailmer","wailord","numel","camerupt","torkoal","spoink","grumpig","spinda","trapinch","vibrava","flygon","cacnea","cacturne","swablu","altaria","zangoose","seviper","lunatone","solrock","barboach","whiscash","corphish","crawdaunt","baltoy","claydol","lileep","cradily","anorith","armaldo","feebas","milotic","castform","kecleon","shuppet","banette","duskull","dusclops","tropius","chimecho","absol","wynaut","snorunt","glalie","spheal","sealeo","walrein","clamperl","huntail","gorebyss","relicanth","luvdisc","bagon","shelgon","salamence","beldum","metang","metagross","regirock","regice","registeel","latias","latios","kyogre","groudon","rayquaza","jirachi","deoxys"];
const spriteText = value => String(value||'').toLowerCase().replace(/[’']/g,'').replace(/♀/g,' f ').replace(/♂/g,' m ').replace(/[^a-z0-9]+/g,' ').trim();
const spriteWords = SPRITE_NAMES.map((name,index)=>({name,id:index+1,words:spriteText(name)})).sort((a,b)=>b.words.length-a.words.length);
function speciesSprite(title) {
  const words=' '+spriteText(title)+' ';
  return spriteWords.find(item=>words.includes(' '+item.words+' '))?.name || '';
}
function sprite(name, className = '') {
  const id=SPRITE_NAMES.indexOf(name)+1 || 130,index=id-1;
  return '<span class="ledger-sprite '+E(className)+'"><span class="spriteIcon gen3-atlas" aria-hidden="true" data-species="'+id+'" style="background-position:'+((index%20)/19*100)+'% '+(Math.floor(index/20)/19*100)+'%"></span></span>';
}
function header() {
  return '<header class="ledger-header"><div class="brand">Poké<em>Ledger</em></div>' +
    '<button type="button" class="save-chip" onclick="nav(\'settings\')" title="Phone storage and backups">' +
    '<span class="save-dot"></span>' + (writeError ? "Save issue" : db.savedAt ? "Saved" : "On device") + '</button></header>';
}
function navigation(active) {
  const items = [
    ["dashboard","gyarados","Home"], ["spending","vaporeon","History"],
    ["add","jolteon","Add"], ["sales","flareon","Resale"], ["settings","umbreon","Settings"]
  ];
  return '<nav class="ledger-nav" aria-label="Main navigation">' + items.map(([key, icon, label]) =>
    key === "add" ? '<button class="ledger-add" type="button" onclick="LedgerUI.openReceipt()" aria-label="Log a purchase"><span>+</span></button>' :
    '<button type="button" class="' + (active === key ? "active" : "") + '" onclick="nav(\'' + key + '\')" ' +
      (active === key ? 'aria-current="page"' : "") + '>' + sprite(icon) + '<span>' + label + '</span></button>'
  ).join("") + '</nav>';
}
function scopePicker() {
  const settings = preferences();
  return '<div class="ledger-period"><select aria-label="Time range" onchange="LedgerUI.setScope(this.value)">' +
    '<option value="month"' + (settings.scope === "month" ? " selected" : "") + '>By month</option>' +
    '<option value="all"' + (settings.scope === "all" ? " selected" : "") + '>All time</option></select>' +
    (settings.scope === "month" ? '<input type="month" aria-label="Month" value="' + E(settings.month) + '" onchange="LedgerUI.setMonth(this.value)">' : "") + '</div>';
}
function periodLabel() {
  const settings = preferences();
  if (settings.scope === "all") return "All time";
  const [year, month] = settings.month.split("-").map(Number);
  return new Date(year, month-1, 15).toLocaleDateString("en-US", {month:"long", year:"numeric"});
}
function setScope(scope) { preferences().scope = scope === "all" ? "all" : "month"; remember(); render(); }
function setMonth(month) { if (/^\d{4}-\d{2}$/.test(month)) { preferences().month = month; remember(); render(); } }
function selectProfile(profile) { preferences().profile = profile; remember(); nav("spending"); }
function labelFor(profile) { return profile === "all" ? "Everyone" : profile === "resale" ? "Resale" : profile.slice(7); }
function errorPanel() {
  if (loadIssue) return '<div class="ledger-alert" role="alert"><b>Saved data needs attention.</b><p>' + E(loadIssue) +
    '</p><button class="btn" onclick="exportUnreadableData()">Download stored data</button> <button class="btn" onclick="importDialog()">Restore backup</button></div>';
  return writeError ? '<div class="ledger-alert" role="alert">Your last change could not be saved. ' + E(writeError) + '</div>' : "";
}
function welcome() {
  const original = previousData();
  return header() + '<section class="ledger-welcome"><div><h1>YOUR<br>SPENDING<br>LEDGER.</h1><p>A fresh ledger for you, Maz, Lalie, and resale.</p></div>' +
    '<div class="welcome-mascot">' + sprite("gyarados") + '</div></section><section class="ledger-panel welcome-start">' +
    '<h2>READY FOR A FRESH START?</h2><p>' + (original ?
      'Download your previous PokéLedger records, then start your spending ledger at $0. Your previous copy stays available in Settings.' :
      'Your purchases, names, budgets, and sales will save automatically on this phone.') + '</p>' +
    '<button id="ledger-begin" class="btn primary" onclick="LedgerUI.begin()">' + (original ? "Back up & start fresh" : "Start my spending ledger") + '</button>' +
    '<small>Open from the same home-screen icon each time to continue your saved ledger.</small></section>';
}
function profileCards() {
  const cards = db.members.map((name, index) => ({key:"person:"+name, label:name, icon:["charizard","jolteon","vaporeon","flareon"][index % 4], color:["yellow","blue","pink","mint"][index % 4]}));
  cards.push({key:"resale", label:"Resale", icon:"umbreon", color:"mint"});
  return '<div class="ledger-profiles">' + cards.map(card => {
    const rows = selectedPurchases(card.key);
    return '<button class="profile-card ' + card.color + '" onclick="' + call("selectProfile", card.key) + '">' +
      '<span class="profile-top"><b>' + E(card.label) + '</b>' + sprite(card.icon) + '</span><strong>' + money(sumRows(rows, card.key)) +
      '</strong><small>' + rows.length + (rows.length === 1 ? ' purchase' : ' purchases') + '</small></button>';
  }).join("") + '</div>';
}
function budgetRows() {
  const month = preferences().scope === "month" ? preferences().month : today().slice(0,7);
  const rows = purchaseRows().filter(transaction => transaction.date?.slice(0,7) === month);
  return '<section class="ledger-panel ledger-budgets"><div class="ledger-section-head"><h2>MONTHLY BUDGETS</h2><button class="text-button" onclick="LedgerUI.openBudgets()">Edit</button></div>' +
    [[PERSONAL,"Personal + kids","hobby"],[RESALE,"Resale","resale"]].map(([purpose, label, key]) => {
      const spent = rows.reduce((sum, transaction) => sum + Math.round(expenseAmount(transaction, null, purpose)*100), 0)/100;
      const limit = Number(db.budgets[key]) || 0;
      const percentage = limit ? Math.min(100, spent / limit * 100) : 0;
      return '<div class="budget-line"><div><b>' + label + '</b><span>' + money(spent) + (limit ? ' / ' + money(limit) : ' · Set a limit') +
        '</span></div><div class="budget-track"><span class="' + key + '" style="width:' + percentage + '%"></span></div>' +
        (limit && spent > limit ? '<small>' + money(spent-limit) + ' over budget</small>' : "") + '</div>';
    }).join("") + '</section>';
}
function transactionRow(transaction, showProfile = "all") {
  const amount = transaction.kind === "purchase" ? amountFor(transaction, showProfile) : Number(transaction.amount) || 0;
  const parts = transaction.kind === "purchase" ? expenseParts(transaction) : [];
  const who = parts.length > 1 ? "Split receipt" : parts[0]?.purpose === RESALE ? "Resale" : transaction.owner || "Me";
  const icon = (transaction.kind !== "cashout" && speciesSprite(transaction.artwork?.name || transaction.title)) || (transaction.kind === "sale" ? "flareon" : transaction.kind === "cashout" ? "umbreon" : who === db.members[0] ? "charizard" : who === "Maz" ? "jolteon" : who === "Lalie" ? "vaporeon" : "gyarados");
  const caption = [transaction.merchant || who, transaction.type, transaction.date].filter(Boolean).join(" · ");
  const artwork = window.PokeArtwork?.thumb(transaction) || '';
  return '<div class="ledger-entry">' + artwork + '<button type="button" class="ledger-transaction" onclick="' + call("details", transaction.id) + '">' + (artwork ? '' : sprite(icon)) +
    '<span class="transaction-copy"><b>' + E(transaction.title) + '</b>' + (window.PokeArtwork?.badge(transaction.type) || '') + '<small>' + E(caption) + '</small></span>' +
    '<strong class="' + (transaction.kind === "sale" ? "positive" : "") + '">' + money(amount) + '</strong></button></div>';
}
function empty(title, text, button = "Log a purchase", action = "LedgerUI.openReceipt()") {
  return '<div class="ledger-empty"><b>' + title + '</b><p>' + text + '</p><button class="btn primary" onclick="' + action + '">' + button + '</button></div>';
}
function cashFlow(transactions = db.transactions) {
  let spent=0, sales=0, payouts=0, transfers=0;
  const amount=value=>Math.round((Number(value)||0)*100);
  for(const row of transactions) {
    if(row.kind==='purchase') spent+=amount(row.amount);
    else if(row.kind==='sale') sales+=amount(row.amount)-amount(row.fees)-amount(row.shipping);
    else if(row.kind==='cashout') {
      if(row.cashflowMode==='sale-transfer') transfers+=amount(row.amount);
      else payouts+=amount(row.amount);
    }
  }
  return {spent:spent/100,sales:sales/100,payouts:payouts/100,transfers:transfers/100,pnl:(sales+payouts-spent)/100};
}
function cashFlowPanel() {
  const flow=cashFlow();
  return '<section class="ledger-panel cashflow-panel"><div class="ledger-section-head"><h2>OVERALL CASH P&amp;L</h2><span>All time</span></div><strong class="cashflow-total '+(flow.pnl<0?'negative':'positive')+'">'+money(flow.pnl)+'</strong><div class="ledger-stats"><div><span>Net resale proceeds</span><b>'+money(flow.sales)+'</b></div><div><span>Payouts received</span><b>'+money(flow.payouts)+'</b></div><div><span>Overall spending</span><b>'+money(flow.spent)+'</b></div></div><p class="ledger-help">Resales after fees and shipping + payouts − all purchases, including personal, family and resale spending. Unsold card values are excluded.</p><p class="ledger-help">Cashouts count as payouts unless marked already included in a sale.'+(flow.transfers?' '+money(flow.transfers)+' in sale transfers excluded.':'')+'</p></section>';
}
function buildCashout(fields, original = null) {
  const gross=cents(fields.grossAmount),net=cents(fields.amount);
  if(!String(fields.merchant||'').trim()) throw Error('Enter the platform or app.');
  if(gross<=0 || net>gross) throw Error('Received cannot exceed requested, and requested must be above $0.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fields.date||'') || !Number.isFinite(Date.parse(fields.date+'T00:00:00Z')) || new Date(fields.date+'T00:00:00Z').toISOString().slice(0,10)!==fields.date) throw Error('Choose a valid cashout date.');
  if(!db.members.includes(fields.owner) && fields.owner!==original?.owner) throw Error('Choose an existing profile.');
  if(!['payout','sale-transfer'].includes(fields.cashflowMode)) throw Error('Choose how this cashout counts toward P&L.');
  return {...(original||{}),id:original?.id||uid(),kind:'cashout',title:String(fields.merchant).trim()+' cashout',type:original?.type||'Platform cashout',purpose:original?.purpose||'Transfer',merchant:String(fields.merchant).trim(),date:fields.date,owner:fields.owner,destination:String(fields.destination||'').trim(),notes:String(fields.notes||'').trim(),amount:net/100,grossAmount:gross/100,fees:(gross-net)/100,cashflowMode:fields.cashflowMode};
}
function openCashout(id = '') {
  const row=id?db.transactions.find(t=>t.id===id && t.kind==='cashout'):null;
  if(id && !row) return alert('This cashout no longer exists.');
  const members=[...new Set([...db.members,...(row?.owner?[row.owner]:[])])];
  show('<h2>'+(row?'EDIT CASHOUT':'LOG CASHOUT')+'</h2><form id="ledger-cashout-form" onsubmit="event.preventDefault();LedgerUI.submitCashout(this,'+E(JSON.stringify(id))+')"><div class="formGrid">'+
  '<label>Platform / app<input class="field" name="merchant" required value="'+E(row?.merchant||'LastPack')+'"></label><label>Cashout date<input class="field" name="date" type="date" required value="'+E(row?.date||today())+'"></label>'+
  '<label>Withdrawal requested ($)<input class="field" name="grossAmount" type="number" inputmode="decimal" min="0.01" step="0.01" required value="'+E(row?(row.grossAmount??Number(row.amount)+Number(row.fees||0)):'')+'"></label>'+
  '<label>Amount actually received ($)<input class="field" name="amount" type="number" inputmode="decimal" min="0" step="0.01" required value="'+E(row?.amount??'')+'"></label>'+
  '<label>Received through<input class="field" name="destination" value="'+E(row?.destination||'')+'" placeholder="PayPal, bank…"></label><label>Who received it?<select class="field" name="owner">'+members.map(name=>'<option value="'+E(name)+'"'+(name===(row?.owner||members[0])?' selected':'')+'>'+E(name)+'</option>').join('')+'</select></label>'+
  '<label class="span2">How should this count toward P&amp;L?<select class="field" name="cashflowMode"><option value="payout"'+(row?.cashflowMode!=='sale-transfer'?' selected':'')+'>Payout — not already recorded as a sale</option><option value="sale-transfer"'+(row?.cashflowMode==='sale-transfer'?' selected':'')+'>Already included in a sale — transfer only</option></select></label>'+
  '<label class="span2">Notes (optional)<textarea class="field" name="notes" rows="2">'+E(row?.notes||'')+'</textarea></label></div><p class="ledger-help">The fee is requested minus received. Transfers already included in sales do not add income again; include any extra withdrawal fee in the recorded sale fees.</p><div class="modalFoot"><button class="btn" type="button" onclick="closeModal()">Cancel</button><button class="btn primary" type="submit">Save cashout</button></div></form>');
}
function submitCashout(form,id = '') {
  try {
    const original=id?db.transactions.find(t=>t.id===id && t.kind==='cashout'):null;
    if(id && !original) throw Error('This cashout no longer exists.');
    const row=buildCashout(Object.fromEntries(new FormData(form)),original);
    const duplicate=db.transactions.some(t=>t.kind==='cashout'&&t.id!==id&&t.date===row.date&&String(t.merchant||'').toLowerCase()===row.merchant.toLowerCase()&&Number(t.amount)===row.amount&&Number(t.grossAmount)===row.grossAmount);
    if(duplicate&&!confirm('A matching cashout already exists on this date. Save another?')) return;
    const next=clone();
    if(id) next.transactions[next.transactions.findIndex(t=>t.id===id)]=row;
    else next.transactions.push(row);
    if(write(next)) closeModal();
  } catch(error) {alert(error.message);}
}
function overview() {
  const rows = selectedPurchases(), total = sumRows(rows);
  const recent = [...rows].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);
  const finances = metrics();
  return '<div class="ledger-heading"><h1>SPENDING.</h1>' + scopePicker() + '</div>' +
    '<section class="spending-hero"><div><span>Total spent · ' + E(periodLabel()) + '</span><strong>' + money(total) +
    '</strong><small>' + rows.length + ' purchases recorded</small></div>' + sprite("gyarados","hero-sprite") + '</section>' +
    profileCards() + cashFlowPanel() + budgetRows() +
    '<section class="ledger-profit-strip"><div><span>Realized sales profit</span><b>' + money(finances.realized) +
    '</b></div><button class="text-button" onclick="nav(\'sales\')">View resale →</button></section>' +
    '<section class="ledger-panel"><div class="ledger-section-head"><h2>RECENT PURCHASES</h2><button class="text-button" onclick="nav(\'spending\')">View all</button></div>' +
    (recent.length ? recent.map(row => transactionRow(row)).join("") : empty("No purchases yet.", "Log a purchase to see your spending here.")) + '</section>';
}
function history() {
  const profile = preferences().profile;
  const rows = selectedPurchases(profile).filter(transaction => !q || (transaction.title+" "+transaction.merchant+" "+transaction.type).toLowerCase().includes(q.toLowerCase()));
  const filters = [{key:"all", label:"Everyone"}, ...db.members.map(name => ({key:"person:"+name, label:name})), {key:"resale", label:"Resale"}];
  return '<div class="ledger-heading"><h1>HISTORY.</h1>' + scopePicker() + '</div>' +
    '<div class="ledger-filter-row">' + filters.map(filter => '<button class="filter-chip ' + (filter.key === profile ? "selected" : "") + '" onclick="' +
      call("selectProfile", filter.key) + '">' + E(filter.label) + '</button>').join("") + '</div>' +
    '<section class="history-total"><span>' + E(labelFor(profile)) + ' · ' + E(periodLabel()) + '</span><b>' + money(sumRows(rows, profile)) + '</b></section>' +
    '<label class="ledger-search">Find a purchase<input class="field" type="search" placeholder="Item, shop, or purchase type" value="' + E(q) + '" onchange="q=this.value;render()"></label>' +
    '<section class="ledger-panel">' + (rows.length ? [...rows].sort((a,b) => b.date.localeCompare(a.date)).map(row => transactionRow(row,profile)).join("") :
      empty("No purchases in this view.", "Log a purchase for this profile or choose another period.")) + '</section>';
}
function resale() {
  const finances = metrics();
  const sales = db.transactions.filter(transaction => transaction.kind === "sale").sort((a,b) => b.date.localeCompare(a.date));
  const cashouts = db.transactions.filter(transaction => transaction.kind === "cashout").sort((a,b) => b.date.localeCompare(a.date));
  const stock = ownedCards();
  return '<div class="ledger-heading"><h1>RESALE.</h1></div>' +
    '<section class="resale-hero"><span>Realized profit · all time</span><strong>' + money(finances.realized) +
    '</strong><small>' + finances.knownSales + ' sales with recorded costs' + (finances.unknownSales ? ' · ' + finances.unknownSales + ' need a cost' : "") + '</small></section>' +
    '<div class="ledger-stats"><div><span>Resale spending</span><b>' + money(finances.resaleSpent) + '</b></div><div><span>Gross sales</span><b>' +
    money(finances.gross) + '</b></div><div><span>Net sale proceeds</span><b>' + money(finances.netSales) + '</b></div></div>' +
    '<div class="ledger-action-grid"><button class="btn primary" onclick="openSale()">+ Record sale</button><button class="btn" onclick="LedgerUI.openCashout()">Log cashout</button></div>' +
    '<section class="ledger-panel"><div class="ledger-section-head"><h2>SALES</h2></div>' +
    (sales.length ? sales.map(row => transactionRow(row)).join("") : empty("No sales yet.", "Record the sale, actual cost, fees, and shipping.", "Record a sale", "openSale()")) + '</section>' +
    '<section class="ledger-panel"><div class="ledger-section-head"><h2>RECORDED COST BASIS</h2><button class="text-button" onclick="openPurchase()">+ Itemized purchase</button></div>' +
    (stock.length ? stock.map(card => '<div class="stock-row"><div><b>' + E(card.name) + '</b><small>' + status(card.id).qty + ' units available</small></div><strong>' +
      (status(card.id).unitCost === null || status(card.id).unitCost === undefined ? "Cost unknown" : money(status(card.id).unitCost) + ' each') + '</strong></div>').join("") :
      '<p class="ledger-help">Itemize a purchase to use its recorded unit cost automatically on a sale. You can also enter a sale’s actual cost manually.</p>') + '</section>' +
    '<section class="ledger-panel"><div class="ledger-section-head"><h2>PLATFORM CASHOUTS</h2><b>' + money(finances.cashoutNet) + '</b></div>' +
    '<p class="ledger-help">Tap an entry to edit it. Cashouts count toward overall cash P&amp;L unless marked already included in a sale. Recorded withdrawal fees: ' + money(finances.cashoutFees) + '.</p>' +
    (cashouts.length ? cashouts.map(row => transactionRow(row)).join("") : '<p class="ledger-help">Log a withdrawal when money arrives from a platform.</p>') + '</section>';
}
function settings() {
  const saved = db.savedAt ? new Date(db.savedAt).toLocaleString() : "No changes saved yet";
  return '<div class="ledger-heading"><h1>SETTINGS.</h1></div><section class="ledger-panel storage-panel"><h2>SAVED ON THIS PHONE</h2><p>Your profiles, purchases, budgets, and sales save automatically after each change.</p><small>Last saved ' + E(saved) +
    '</small><div class="ledger-action-grid"><button class="btn primary" onclick="exportJSON()">Export backup JSON</button><button class="btn" onclick="importDialog()">Import backup</button></div>' +
    '<button class="text-button" onclick="exportCSV()">Export transactions CSV →</button>' +
    (previousData() ? '<div class="previous-backup"><b>Previous PokéLedger records</b><p>Your copy from before the fresh start is available here.</p><button class="btn" onclick="LedgerUI.exportPrevious()">Download previous backup</button></div>' : "") +
    '</section><section class="ledger-panel"><h2>YOUR PEOPLE</h2>' + db.members.map((name,index) => '<div class="profile-setting">' + sprite(["charizard","jolteon","vaporeon"][index%3]) +
    '<b>' + E(name) + '</b><button class="text-button" onclick="' + call("renameProfile", name) + '">Rename</button></div>').join("") +
    '<button class="text-button" onclick="LedgerUI.addProfile()">+ Add profile</button></section>' +
    '<section class="ledger-panel"><div class="ledger-section-head"><h2>MONTHLY BUDGETS</h2><button class="btn" onclick="LedgerUI.openBudgets()">Edit budgets</button></div><p>Personal + kids ' +
    money(db.budgets.hobby) + ' · Resale ' + money(db.budgets.resale) + '</p></section>' +
    '<details class="ledger-panel"><summary>Optional private cloud backup</summary><p class="ledger-help">' + E(cloudStatus) + '</p>' + cloudPanel() + '</details>';
}
function renderPage(active) {
  if (!hasStarted() && !loadIssue) return welcome();
  const screens = {dashboard:overview, spending:history, sales:resale, settings};
  return header() + errorPanel() + (screens[active] || overview)() + navigation(active);
}
function openReceipt(id = "", target = "") {
  const transaction = id ? db.transactions.find(row => row.id === id && row.kind === "purchase") : null;
  const parts = transaction ? expenseParts(transaction) : [];
  const selected = transaction ? parts.length > 1 ? "split" : parts[0]?.purpose === RESALE ? "resale" : parts[0]?.owner : target || "Me";
  const recipients = [...db.members.map(name => [name,name]), ["resale","Resale"], ["split","Split this receipt"]];
  const options = recipients.map(([value,label]) => '<option value="' + E(value) + '"' + (value === selected ? ' selected' : '') + '>' + E(label) + '</option>').join("");
  const split = [...db.members.map(name => ({key:"person:"+name,label:name,owner:name,purpose:PERSONAL})),{key:"resale",label:"Resale",owner:db.members[0]||"Me",purpose:RESALE}];
  show('<h2>' + (transaction ? 'EDIT PURCHASE' : 'LOG A PURCHASE') + '</h2><form id="ledger-receipt-form" onsubmit="event.preventDefault();LedgerUI.submitReceipt(this,' + E(JSON.stringify(id)) + ')">' +
    '<label class="receipt-amount">Receipt total <span>Include tax and shipping</span><div>$<input name="amount" type="number" inputmode="decimal" min="0" step="0.01" required placeholder="0.00" value="' + E(transaction?.amount ?? "") + '" oninput="LedgerUI.recalculate()"></div></label>' +
    '<div class="formGrid"><label class="span2">What did you buy?<input class="field" name="title" required placeholder="Cards, packs, supplies…" value="' + E(transaction?.title||"") + '"></label>' +
    '<label>For<select class="field" name="recipient" onchange="LedgerUI.recipient(this.value)">' + options + '</select></label>' +
    '<label>Date<input class="field" type="date" name="date" required value="' + E(transaction?.date||today()) + '"></label></div>' +
    '<div id="ledger-splits"' + (selected !== "split" ? ' hidden' : '') + '><h3>SPLIT THE RECEIPT</h3>' + split.map(part => {
      const amount = parts.filter(row => row.owner === part.owner && row.purpose === part.purpose).reduce((sum,row) => sum+Number(row.amount),0);
      return '<label class="split-line">' + E(part.label) + '<span>$ <input type="number" inputmode="decimal" min="0" step="0.01" class="field" data-split-owner="' + E(part.owner) + '" data-split-purpose="' + part.purpose + '" value="' + E(amount || "") + '" placeholder="0.00" oninput="LedgerUI.recalculate()"></span></label>';
    }).join("") + '<p id="ledger-split-status" role="status"></p></div>' +
    '<div class="formGrid"><label>Shop / platform<input class="field" name="merchant" placeholder="Whatnot, card shop…" value="' + E(transaction?.merchant||"") + '"></label>' +
    '<label>Purchase type <small>Optional · your own label</small><input class="field" name="type" maxlength="60" placeholder="PSA 10 slab, Raw, Boosters…" value="' + E(transaction?.type||"") + '"></label>' +
    '<label class="span2">Notes <small>Optional</small><textarea class="field" name="notes" rows="2">' + E(transaction?.notes||"") + '</textarea></label></div>' +
    (window.PokeArtwork?.editor(transaction?.artwork) || '') +
    '<details class="receipt-extra"><summary>Receipt / order link</summary><input class="field" name="receipt" type="url" placeholder="https://…" value="' + E(transaction?.receipt||"") + '"></details>' +
    '<div class="modalFoot"><button class="btn" type="button" onclick="closeModal()">Cancel</button><button class="btn primary" type="submit">Save purchase</button></div></form>');
  recalculate();
}
function recipient(value) {
  const panel = document.getElementById("ledger-splits");
  if (panel) panel.hidden = value !== "split";
  recalculate();
}
function recalculate() {
  const form = document.getElementById("ledger-receipt-form"), status = document.getElementById("ledger-split-status");
  if (!form || !status || form.elements.recipient.value !== "split") return;
  try {
    const total = cents(form.elements.amount.value);
    const allocated = [...form.querySelectorAll("[data-split-owner]")].reduce((sum,input) => sum+cents(input.value || "0"),0);
    const difference = total-allocated;
    status.textContent = difference === 0 ? "✓ Receipt fully allocated." : difference > 0 ? money(difference/100)+" left to allocate" : money(-difference/100)+" over the receipt total";
    status.dataset.valid = difference === 0 ? "true" : "false";
  } catch { status.textContent = "Enter the total, then split it between profiles."; }
}
function submitReceipt(form, id = "") {
  try {
    const fields = Object.fromEntries(new FormData(form));
    const allocations = fields.recipient === "split" ? [...form.querySelectorAll("[data-split-owner]")]
      .filter(input => Number(input.value) > 0).map(input => ({owner:input.dataset.splitOwner,purpose:input.dataset.splitPurpose,amount:input.value})) :
      [{owner:fields.recipient === "resale" ? db.members[0]||"Me" : fields.recipient,purpose:fields.recipient === "resale" ? RESALE : PERSONAL,amount:fields.amount}];
    const receipt = buildReceipt(fields, allocations), next = clone();
    const artwork = window.PokeArtwork?.read(form);
    if (artwork !== undefined) receipt.artwork = artwork;
    if (id) {
      const index = next.transactions.findIndex(row => row.id === id && row.kind === "purchase");
      if (index < 0) throw Error("This purchase no longer exists.");
      const original = next.transactions[index];
      const itemized = (original.haulCards||[]).reduce((sum,line) => sum+Math.round(Number(line.unitCost)*100)*Number(line.qty),0);
      if (itemized > Math.round(receipt.amount*100)) throw Error("The total must cover the recorded item costs.");
      next.transactions[index] = {...original,...receipt,id};
    } else next.transactions.push(receipt);
    if (write(next)) closeModal();
  } catch (error) { alert(error.message); }
}
function openBudgets() {
  show('<h2>MONTHLY BUDGETS</h2><form onsubmit="event.preventDefault();LedgerUI.submitBudgets(this)"><div class="formGrid">' +
    '<label>Personal + kids ($)<input class="field" type="number" inputmode="decimal" min="0" step="0.01" name="hobby" required value="' + E(db.budgets.hobby) + '"></label>' +
    '<label>Resale ($)<input class="field" type="number" inputmode="decimal" min="0" step="0.01" name="resale" required value="' + E(db.budgets.resale) + '"></label></div>' +
    '<p class="ledger-help">Use 0 for a budget without a spending limit.</p><div class="modalFoot"><button type="button" class="btn" onclick="closeModal()">Cancel</button><button class="btn primary">Save budgets</button></div></form>');
}
function submitBudgets(form) {
  try {
    const fields = Object.fromEntries(new FormData(form)), next = clone();
    next.budgets = {hobby:cents(fields.hobby)/100,resale:cents(fields.resale)/100};
    next.budget = next.budgets.hobby+next.budgets.resale;
    if (write(next)) closeModal();
  } catch(error) { alert(error.message); }
}
function renameProfile(old) {
  const answer = prompt("Profile name", old);
  if (answer === null) return;
  const newer = answer.trim().slice(0,45);
  if (!newer || newer === old) return;
  if (db.members.some(name => name.toLowerCase() === newer.toLowerCase())) return alert("Another profile already uses that name.");
  const next = clone();
  next.members = next.members.map(name => name === old ? newer : name);
  for (const transaction of next.transactions) {
    if (transaction.owner === old) transaction.owner = newer;
    for (const part of transaction.allocations || []) if (part.owner === old) part.owner = newer;
  }
  for (const row of Object.values(next.statuses)) if (row.owner === old) row.owner = newer;
  for (const binder of next.binders || []) if (binder.owner === old) binder.owner = newer;
  if (write(next) && preferences().profile === "person:"+old) { preferences().profile = "person:"+newer; remember(); }
}
function addProfile() {
  const answer = prompt("Profile name");
  if (!answer?.trim()) return;
  const name = answer.trim().slice(0,45);
  if (db.members.some(value => value.toLowerCase() === name.toLowerCase())) return alert("That profile already exists.");
  const next = clone(); next.members.push(name); write(next);
}
function editCost(id) {
  const sale = db.transactions.find(row => row.id === id && row.kind === "sale");
  if (!sale) return;
  show('<h2>SALE COST BASIS</h2><p>' + E(sale.title) + '</p><form onsubmit="event.preventDefault();LedgerUI.saveCost(this,' + E(JSON.stringify(id)) + ')">' +
    '<label>Actual acquisition cost ($)<input class="field" name="cost" inputmode="decimal" type="number" min="0" step="0.01" value="' + E(sale.costBasis ?? "") +
    '" placeholder="Leave blank if unknown"></label><div class="modalFoot"><button class="btn" type="button" onclick="closeModal()">Cancel</button><button class="btn primary">Save cost</button></div></form>');
}
function saveCost(form,id) {
  try {
    const value = new FormData(form).get("cost"), next = clone(), sale = next.transactions.find(row => row.id === id && row.kind === "sale");
    if (!sale) return;
    sale.costBasis = value === "" ? null : cents(value)/100;
    if (write(next)) closeModal();
  } catch(error) { alert(error.message); }
}
function details(id) {
  const transaction = db.transactions.find(row => row.id === id);
  if (!transaction) return;
  const knownCost = transaction.costBasis !== null && transaction.costBasis !== undefined && transaction.costBasis !== "";
  const rows = transaction.kind === "purchase" ? expenseParts(transaction).map(part => '<div class="detail-line"><span>' +
    E(part.purpose === RESALE ? "Resale" : part.owner) + '</span><b>' + money(part.amount) + '</b></div>').join("") :
    transaction.kind === "sale" ? '<div class="detail-line"><span>Fees</span><b>' + money(transaction.fees) + '</b></div><div class="detail-line"><span>Seller shipping</span><b>' + money(transaction.shipping) +
    '</b></div><div class="detail-line"><span>Actual cost</span><b>' + (knownCost ? money(transaction.costBasis) : "Unknown") + '</b></div><div class="detail-line"><span>Realized profit</span><b>' +
    (knownCost ? money(transaction.amount-(Number(transaction.fees)||0)-(Number(transaction.shipping)||0)-Number(transaction.costBasis)) : "Needs cost basis") + '</b></div>' :
    '<div class="detail-line"><span>Withdrawal requested</span><b>' + money(transaction.grossAmount) + '</b></div><div class="detail-line"><span>Withdrawal fee</span><b>' + money(transaction.fees) + '</b></div><div class="detail-line"><span>Cash P&amp;L</span><b>' + (transaction.cashflowMode==='sale-transfer'?'Transfer only':'Payout received') + '</b></div>';
  show('<h2>' + E(transaction.title) + '</h2><p class="ledger-help">' + E([transaction.date,transaction.merchant,transaction.type].filter(Boolean).join(" · ")) + '</p>' +
    '<div class="detail-total">' + money(transaction.amount) + '</div>' + (window.PokeArtwork?.thumb(transaction) || '') + (window.PokeArtwork?.badge(transaction.type) || '') + rows +
    (transaction.notes ? '<p class="detail-notes">' + E(transaction.notes) + '</p>' : "") +
    (transaction.receipt && /^https?:\/\//i.test(transaction.receipt) ? '<a class="text-button" href="' + E(transaction.receipt) + '" target="_blank" rel="noopener noreferrer">Open receipt ↗</a>' : "") +
    '<div class="modalFoot">' + (transaction.kind === "purchase" ? '<button class="btn" onclick="' + call("openReceipt",id) + '">Edit purchase</button>' : transaction.kind === "sale" ? '<button class="btn" onclick="' + call("editCost",id) + '">Edit cost</button>' : transaction.kind === "cashout" ? '<button class="btn" onclick="' + call("openCashout",id) + '">Edit cashout</button>' : "") +
    '<button class="btn danger" onclick="' + call("remove",id) + '">Remove</button><button class="btn primary" onclick="closeModal()">Done</button></div>');
}
function remove(id) {
  if (!confirm("Remove this entry?")) return;
  const next = clone(), transaction = next.transactions.find(row => row.id === id);
  if (!transaction) return;
  if (transaction.kind === "sale" && transaction.inventoryDeducted && transaction.cardId) {
    const stock = next.statuses[transaction.cardId];
    if (stock) {
      const quantity = Number(stock.qty)||0, returning = Number(transaction.quantity)||0;
      const total = quantity+returning;
      const known = stock.unitCost !== null && stock.unitCost !== undefined && transaction.costBasis !== null && transaction.costBasis !== undefined;
      stock.unitCost = known && total ? (Number(stock.unitCost)*quantity+Number(transaction.costBasis))/total : null;
      stock.qty = total; stock.state = total ? "Owned" : "Not tracked";
    }
  }
  next.transactions = next.transactions.filter(row => row.id !== id);
  if (write(next)) closeModal();
}
window.LedgerUI = {
  render:renderPage,startPage,rememberPage,begin,exportPrevious,setScope,setMonth,selectProfile,
  openReceipt,submitReceipt,recipient,recalculate,openBudgets,submitBudgets,renameProfile,addProfile,
  speciesSprite,sprite,cashFlow,buildCashout,openCashout,submitCashout,details,remove,editCost,saveCost,buildReceipt,cents,selectedPurchases,sumRows,write
};
})();
