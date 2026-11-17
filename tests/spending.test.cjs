const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const db={members:['Me','Maz','Lalie'],transactions:[],cards:[],statuses:{},notes:{},budgets:{hobby:200,resale:0}};
 const window={};
 vm.runInNewContext(fs.readFileSync('ledger.js','utf8'),{window,db,uid:()=> 'test'});
 return window.LedgerUI;
}
test('shared receipt counts its total once and retains exact allocations',()=>{
 const app=harness();
 const row=app.buildReceipt({title:'Cards',date:'2026-11-17',amount:'100'},[
 {owner:'Me',purpose:'Hobby / family',amount:'20'},
 {owner:'Maz',purpose:'Hobby / family',amount:'25'},
 {owner:'Lalie',purpose:'Hobby / family',amount:'15'},
 {owner:'Me',purpose:'Resale inventory',amount:'40'}]);
 assert.equal(row.amount,100);assert.equal(row.allocations.length,4);
 assert.throws(()=>app.buildReceipt({title:'Bad',date:'2026-11-17',amount:'100'},[{owner:'Me',purpose:'Hobby / family',amount:'101'}]),/equal/);
 assert.equal(app.cents('0.10')+app.cents('0.20'),30);
 assert.throws(()=>app.cents('-1'));
});

test('custom purchase types preserve text and accept blank; reject excess length and paid giveaways',()=>{
 const app=harness();
 const fields={title:'Charizard',date:'2026-11-17',amount:'80'};
 const parts=[{owner:'Me',purpose:'Hobby / family',amount:'80'}];
 for(const type of ['PSA 10 slab','CGC Pristine 10','Raw','Boosters','Singles','<b>My label</b>']) {
  const row=app.buildReceipt({...fields,type:'  '+type+'  '},parts);
  assert.equal(row.type,type);
  assert.equal(JSON.parse(JSON.stringify(row)).type,type);
  assert.equal(row.amount,80);
 }
 assert.equal(app.buildReceipt({...fields,type:'   '},parts).type,'');
 assert.equal(app.buildReceipt(fields,parts).type,'');
 assert.throws(()=>app.buildReceipt({...fields,type:'x'.repeat(61)},parts),/60 characters/);
 assert.throws(()=>app.buildReceipt({...fields,type:' giveaway '},parts),/\$0/);
 const free=app.buildReceipt({...fields,amount:'0',type:'Giveaway'},[{...parts[0],amount:'0'}]);
 assert.equal(free.amount,0);
});
