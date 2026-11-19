// Dependency-free smoke test using the Chrome preinstalled on GitHub's Ubuntu runner.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { setTimeout: delay } = require('node:timers/promises');

test('mobile Chrome: standalone manifest, touch navigation, offline relaunch and local records', {
  skip: !process.env.GITHUB_ACTIONS && !process.env.CHROME_BIN, timeout: 60000
}, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pokeledger-chrome-'));
  const server = http.createServer(async (req, res) => {
    const file = new URL(req.url, 'http://localhost').pathname.match(/^\/pokeledger\/((?:(?:fonts|vendor|data(?:\/tcgplayer-prices)?)\/)?[\w.-]*)$/)?.[1];
    try {
      if (file === undefined || file.startsWith('.')) throw Error();
      if(file==='data/tcgplayer-prices/999.json'){
        res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({unit:'USD',updated:new Date().toISOString(),products:{'9990001':{holofoil:2.79}}}));
        return;
      }
      const name = file || 'index.html';
      const type = {html:'text/html',js:'text/javascript',png:'image/png',webmanifest:'application/manifest+json',svg:'image/svg+xml',json:'application/json',css:'text/css',ttf:'font/ttf'}[name.split('.').pop()];
      if (!type) throw Error();
      const data = await fs.readFile(name);
      res.writeHead(200, {'Content-Type':type}).end(data);
    } catch {res.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const url = 'http://127.0.0.1:' + server.address().port + '/pokeledger/';
  const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', [
    '--headless','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0',
    '--disable-background-networking','--disable-gpu','--no-first-run','--user-data-dir='+root,'about:blank'
  ],{stdio:['ignore','ignore','pipe']});
  let diagnostics='';
  chrome.stderr.on('data',chunk=>{diagnostics=(diagnostics+chunk).slice(-1500);});
  t.after(async () => {
    chrome.kill('SIGKILL'); server.closeAllConnections(); server.close();
    await fs.rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  });
  let port;
  for (let i=0;i<200 && chrome.exitCode===null && !port;i++) {
    try {port=(await fs.readFile(path.join(root,'DevToolsActivePort'),'utf8')).split('\n')[0];}
    catch {await delay(100);}
  }
  assert.ok(port,'Chrome startup: '+diagnostics);
  const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  const ws=new WebSocket(targets.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  t.after(()=>ws.close());
  let sequence=0;
  const pending=new Map();
  ws.onmessage=event=>{
    const msg=JSON.parse(event.data);
    if(msg.method==='Runtime.exceptionThrown')console.error(msg.params.exceptionDetails.exception?.description);
    if(!pending.has(msg.id))return;
    const {resolve,reject}=pending.get(msg.id);
    pending.delete(msg.id);
    if(msg.error)reject(Error(msg.error.message));else resolve(msg.result);
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const reply=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    assert.ok(!reply.exceptionDetails,reply.exceptionDetails?.exception?.description);
    return reply.result.value;
  };
  async function waitFor(expression){
    for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(100);}
    assert.fail('Timed out waiting for '+expression+' at '+await evaluate('location.href+", nav: "+typeof nav+", body: "+document.body?.innerText.slice(0,100)'));
  }
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs',{urls:['https://*']});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true});
  await send('Page.navigate',{url});
  await waitFor('!!navigator.serviceWorker?.controller && typeof nav==="function"');

  const previous={members:['Me','Kid 1'],cards:[],statuses:{},transactions:[{id:'previous',kind:'purchase',title:'Previous records',amount:12,date:'2026-11-17'}]};
  await evaluate('localStorage.setItem("pokeledger-v1",'+JSON.stringify(JSON.stringify(previous))+')');
  await evaluate('LedgerUI.begin()');
  assert.deepEqual(JSON.parse(await evaluate('localStorage.getItem("pokeledger-v1")')),previous);
  assert.deepEqual(await evaluate('db.members'),['Me','Maz','Lalie']);
  await evaluate(`LedgerUI.openReceipt();const f=document.getElementById("ledger-receipt-form");f.elements.amount.value="100";f.elements.title.value="Sample shared purchase";f.elements.type.value="CGC Pristine 10";f.elements.recipient.value="split";LedgerUI.recipient("split");const amounts=[20,25,15,40];[...f.querySelectorAll("[data-split-owner]")].forEach((el,i)=>el.value=amounts[i]);LedgerUI.submitReceipt(f)`);
  assert.equal(await evaluate('db.transactions[0].type'),'CGC Pristine 10');
  await evaluate(`(async()=>{LedgerUI.openReceipt(db.transactions[0].id);document.querySelector('.art-editor').open=true;document.querySelector('.art-query').value='Charizard';window.originalFetch=window.fetch;window.fetch=async(url)=>({ok:true,json:async()=>url.includes('/cards?')?[{id:'me02-013',name:'Mega Charizard X ex',localId:'013',image:'https://assets.tcgdex.net/en/me/me02/013'},{id:'mep-023',name:'Mega Charizard X ex',localId:'023'},{id:'mep-029',name:'Mega Charizard X ex',localId:'029'},...['109','125','130'].map(n=>({id:'me02-'+n,name:'Mega Charizard X ex',localId:n,image:'https://assets.tcgdex.net/en/me/me02/'+n}))]:({id:url.split('/').pop(),variants_detailed:url.endsWith('mep-023')?[{size:'standard',thirdParty:{tcgplayer:659612}}]:[]})});await PokeArtwork.search(document.querySelector('.art-editor .btn'),1);if(document.querySelectorAll('.art-result').length!==6)throw Error('Missing catalog results');PokeArtwork.choose(document.querySelectorAll('.art-result')[1],1);LedgerUI.submitReceipt(document.getElementById('ledger-receipt-form'),db.transactions[0].id);window.fetch=window.originalFetch})()`);
  assert.equal(await evaluate('db.transactions[0].artwork.id'),'mep-023');
  assert.equal(await evaluate('document.querySelectorAll(".art-thumb").length'),1);
  assert.equal(await evaluate('document.querySelector(".art-thumb").click();document.querySelector(".art-viewer .art-card").src'),'https://tcgplayer-cdn.tcgplayer.com/product/659612_in_400x400.jpg');
  await evaluate('PokeArtwork.zoom(document.querySelector(".art-viewer .btn"))');
  assert.equal(await evaluate('document.querySelector(".art-zoom").classList.contains("enlarged")'),true);
  await evaluate('closeModal()');

  await evaluate('LedgerUI.openReceipt(db.transactions[0].id)');
  assert.equal(await evaluate(`document.querySelector('[name=type]').tagName`),'INPUT');
  assert.equal(await evaluate(`document.querySelector('[name=type]').value`),'CGC Pristine 10');
  await evaluate('closeModal()');
  assert.equal(await evaluate('metrics().spent'),100);
  assert.equal(await evaluate('metrics().hobbySpent'),60);
  assert.equal(await evaluate('metrics().resaleSpent'),40);
  await evaluate(`nav('settings');document.querySelectorAll('.profile-setting button')[1].click()`);
  assert.equal(await evaluate("document.querySelector('[name=species]').options.length"),386);
  await evaluate(`{const f=document.querySelector('#modalroot form');f.elements.species.value='pikachu';f.elements.species.dispatchEvent(new Event('change'))}`);
  assert.equal(await evaluate("document.querySelector('.profile-preview [data-species]').dataset.species"),'25');
  await evaluate("document.querySelector('#modalroot button[type=button]').click()");
  assert.equal(await evaluate("db.profileSprites?.Maz || null"),null);
  await evaluate(`LedgerUI.renameProfile('Maz');{const f=document.querySelector('#modalroot form');f.elements.species.value='pikachu';f.requestSubmit()}`);
  assert.equal(await evaluate("db.profileSprites.Maz"),'pikachu');
  await evaluate(`window.alert=()=>{};LedgerUI.renameProfile('Maz');{const f=document.querySelector('#modalroot form');f.elements.label.value='me';f.requestSubmit()}`);
  assert.deepEqual(await evaluate('db.members'),['Me','Maz','Lalie']);
  await evaluate(`{const f=document.querySelector('#modalroot form');f.elements.label.value='Maz saved';f.requestSubmit()}`);
  await send('Page.reload');
  await waitFor('typeof db!=="undefined" && db.transactions.length===1');
  assert.equal(await evaluate('db.transactions[0].type'),'CGC Pristine 10');
  assert.equal(await evaluate('db.transactions[0].artwork.id'),'mep-023');
  assert.deepEqual(await evaluate('db.members'),['Me','Maz saved','Lalie']);
  assert.equal(await evaluate('db.transactions[0].allocations[1].owner'),'Maz saved');
  assert.equal(await evaluate("db.profileSprites['Maz saved']"),'pikachu');
  await evaluate(`LedgerUI.renameProfile('Maz saved');{const f=document.querySelector('#modalroot form');f.elements.label.value='Maz';f.requestSubmit()}nav('dashboard')`);
  assert.equal(await evaluate("document.querySelectorAll('.profile-card [data-species]')[1].dataset.species"),'25');
  await evaluate(`LedgerUI.openCashout();{const f=document.getElementById('ledger-cashout-form');f.elements.grossAmount.value='100';f.elements.amount.value='94';LedgerUI.submitCashout(f);}`);
  assert.equal(await evaluate('LedgerUI.cashFlow().pnl'),-6);
  await evaluate(`LedgerUI.openCashout(db.transactions.find(t=>t.kind==='cashout').id);{const f=document.getElementById('ledger-cashout-form');f.elements.amount.value='90';LedgerUI.submitCashout(f,db.transactions.find(t=>t.kind==='cashout').id);}`);
  assert.equal(await evaluate('LedgerUI.cashFlow().pnl'),-10);
  assert.equal(await evaluate('db.transactions.length'),2);
  assert.equal(await evaluate('db.transactions[1].fees'),10);
  await send('Page.reload');
  await waitFor('typeof db!=="undefined" && db.transactions.length===2');
  assert.equal(await evaluate('LedgerUI.cashFlow().pnl'),-10);
  await evaluate(`LedgerUI.openCashout(db.transactions[1].id);{const f=document.getElementById('ledger-cashout-form');f.elements.cashflowMode.value='sale-transfer';LedgerUI.submitCashout(f,db.transactions[1].id);}`);
  assert.equal(await evaluate('LedgerUI.cashFlow().pnl'),-100);
  assert.equal(await evaluate('metrics().spent'),100);
  await evaluate(`LedgerUI.openCashout(db.transactions[1].id);{const f=document.getElementById('ledger-cashout-form');f.elements.cashflowMode.value='payout';LedgerUI.submitCashout(f,db.transactions[1].id);}`);
  for(const width of [320,390,430]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:2,mobile:true});
    for(const section of ['dashboard','spending','sales','settings']){
      await evaluate('nav('+JSON.stringify(section)+')');
      assert.ok(await evaluate('document.documentElement.scrollWidth')<=width,section+' overflow at '+width);
    }
  }
  await evaluate('nav("dashboard")');
  const shot=await send('Page.captureScreenshot',{format:'png'});
  await fs.writeFile('/tmp/pokeledger-spending-mobile.png',Buffer.from(shot.data,'base64'));
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
  await send('Page.reload');
  await waitFor('typeof db!=="undefined" && db.transactions.length===2');
  assert.equal(await evaluate('LedgerUI.cashFlow().pnl'),-10);
  assert.deepEqual(await evaluate('db.members'),['Me','Maz','Lalie']);
});
