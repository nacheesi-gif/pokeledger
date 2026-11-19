const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(rows=[]){
 const box={window:{},db:{members:['Me','Maz'],transactions:rows,statuses:{keep:{qty:2}},cards:[]},uid:()=> 'new-id',FormData:class{constructor(form){return Object.entries(form)}},validateSnapshot:()=>{},persist:()=>{},render:()=>{},scheduleCloudSave:()=>{},closeModal:()=>{},alert:message=>{box.error=message},confirm:()=>true};
 vm.createContext(box);vm.runInContext(fs.readFileSync('ledger.js','utf8'),box);return {box,app:box.window.LedgerUI};
}
const fields={merchant:' LastPack ',date:'2026-11-18',grossAmount:'100',amount:'94',owner:'Me',destination:'PayPal',notes:'example',cashflowMode:'payout'};
test('overall cash P&L includes net resales and payouts against every purchase once',()=>{
 const {app}=setup();
 const rows=[{kind:'purchase',amount:100,allocations:[{amount:60},{amount:40}]},{kind:'purchase',amount:50,purpose:'Resale inventory'},{kind:'sale',amount:120,fees:10,shipping:5,costBasis:40},{kind:'sale',amount:10,costBasis:null},{kind:'cashout',amount:94,grossAmount:100,fees:6}];
 const f=app.cashFlow(rows);assert.equal(f.spent,150);assert.equal(f.sales,115);assert.equal(f.payouts,94);assert.equal(f.pnl,59);
 assert.equal(app.cashFlow([{kind:'purchase',amount:100}]).pnl,-100);
 assert.equal(app.cashFlow([]).pnl,0);
 assert.equal(app.cashFlow([{kind:'purchase',amount:.1},{kind:'purchase',amount:.2},{kind:'cashout',amount:.3}]).pnl,0);
 rows.push({kind:'cashout',amount:100,cashflowMode:'sale-transfer'});assert.equal(app.cashFlow(rows).pnl,59);assert.equal(app.cashFlow(rows).transfers,100);
});
test('cashout edit preserves identity and unrelated fields, recalculates fees and rejects invalid amounts',()=>{
 const {app}=setup(),old={id:'keep',kind:'cashout',artwork:{id:'keep'},extra:'keep'};
 const row=app.buildCashout({...fields,amount:'95.10'},old);
 assert.equal(row.id,'keep');assert.equal(row.fees,4.9);assert.equal(row.amount,95.1);assert.equal(row.extra,'keep');assert.equal(row.artwork.id,'keep');
 for(const changes of [{amount:'101'},{amount:'-1'},{amount:'NaN'},{amount:'1.001'},{grossAmount:'0'},{date:'2026-02-31'},{merchant:' '},{owner:'Missing'},{cashflowMode:'unknown'}])assert.throws(()=>app.buildCashout({...fields,...changes},old));
});
test('cashout saving edits in place, preserves inventory and restores data on storage errors',()=>{
 const {app,box}=setup([{...fields,id:'keep',kind:'cashout',amount:94,grossAmount:100,fees:6}]);
 app.submitCashout({...fields,amount:'90'},'keep');assert.equal(box.db.transactions.length,1);assert.equal(box.db.transactions[0].id,'keep');assert.equal(box.db.transactions[0].fees,10);assert.equal(box.db.statuses.keep.qty,2);
 const before=JSON.stringify(box.db);box.persist=()=>{throw Error('storage full')};app.submitCashout({...fields,amount:'80'},'keep');assert.equal(JSON.stringify(box.db),before);assert.match(box.error,/storage full/);
 app.submitCashout(fields,'missing');assert.equal(JSON.stringify(box.db),before);
});
test('matching Gen 3 sprites use whole species names and safe unknown fallback',()=>{
 const {app}=setup();
 for(const [title,name] of [['Mega Charizard X ex PSA 10','charizard'],['Gyarados ex','gyarados'],['Mewtwo VSTAR','mewtwo'],['Pikachu promo','pikachu'],["Farfetch’d",'farfetchd'],['Mr. Mime','mr-mime'],['Nidoran♀','nidoran-f']]) assert.equal(app.speciesSprite(title),name);
 for(const title of ['Four booster packs','Mewtwosome','Charizardish','']) assert.equal(app.speciesSprite(title),'');
 assert.match(app.sprite('gyarados'),/data-species="130"/);
 assert.match(app.sprite('<img onerror=evil>'),/data-species="130"/);
 assert.doesNotMatch(app.sprite('<img onerror=evil>'),/onerror/);
 const names=JSON.parse(fs.readFileSync('data/gen3-species.json'));
 assert.equal(names.length,386);assert.equal(new Set(names).size,386);
 names.forEach((name,i)=>assert.match(app.sprite(name),new RegExp('data-species="'+(i+1)+'"')));
});
