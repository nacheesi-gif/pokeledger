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
  await evaluate('LedgerUI.openReceipt(db.transactions[0].id)');
  assert.equal(await evaluate(`document.querySelector('[name=type]').tagName`),'INPUT');
  assert.equal(await evaluate(`document.querySelector('[name=type]').value`),'CGC Pristine 10');
  await evaluate('closeModal()');
  assert.equal(await evaluate('metrics().spent'),100);
  assert.equal(await evaluate('metrics().hobbySpent'),60);
  assert.equal(await evaluate('metrics().resaleSpent'),40);
  await evaluate('window.prompt=()=>"Maz saved";LedgerUI.renameProfile("Maz")');
  await send('Page.reload');
  await waitFor('typeof db!=="undefined" && db.transactions.length===1');
  assert.equal(await evaluate('db.transactions[0].type'),'CGC Pristine 10');
  assert.deepEqual(await evaluate('db.members'),['Me','Maz saved','Lalie']);
  assert.equal(await evaluate('db.transactions[0].allocations[1].owner'),'Maz saved');
  await evaluate('window.prompt=()=>"Maz";LedgerUI.renameProfile("Maz saved")');
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
  await waitFor('typeof db!=="undefined" && db.transactions.length===1');
  assert.deepEqual(await evaluate('db.members'),['Me','Maz','Lalie']);
});
