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
