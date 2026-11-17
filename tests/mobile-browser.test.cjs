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
    const file = new URL(req.url, 'http://localhost').pathname.match(/^\/pokeledger\/((?:(?:vendor|data\/tcgplayer-prices)\/)?[\w.-]*)$/)?.[1];
    try {
      if (file === undefined || file.startsWith('.')) throw Error();
      const name = file || 'index.html';
      const type = {html:'text/html',js:'text/javascript',png:'image/png',webmanifest:'application/manifest+json',svg:'image/svg+xml',json:'application/json'}[name.split('.').pop()];
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
  const manifest=await send('Page.getAppManifest');
  assert.deepEqual(manifest.errors,[]);
  assert.equal(JSON.parse(manifest.data).display,'standalone');
  const fixture={members:['Fixture'],cards:[],statuses:{},transactions:[],budget:43};
  await evaluate('localStorage.setItem("pokeledger-v1",'+JSON.stringify(JSON.stringify(fixture))+')');
  // Disconnect the actual origin, including service-worker fetches.
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
  await send('Page.navigate',{url:url+'index.html?offline-check'});
  await waitFor('location.search==="?offline-check" && typeof db!=="undefined" && db.members[0]==="Fixture"');
  for(const width of [320,390,430]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:2,mobile:true});
    for(const section of ['collection','scanner','slabs','restocks','spending','sales','settings','dashboard','explore']){
      const selector='.navBottom button[onclick="nav(\''+section+'\')"]';
      const point=await evaluate('(()=>{const b=document.querySelector('+JSON.stringify(selector)+');b.scrollIntoView({block:"nearest",inline:"center"});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,h:r.height}})()');
      assert.ok(point.h>=44,section+' tap height');
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y}]});
      await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await waitFor('page==='+JSON.stringify(section));
      if(section==='scanner'){
        const geometry=await evaluate('(()=>{const v=document.querySelector(".psc-viewport").getBoundingClientRect(),g=document.querySelector(".psc-guidebox").getBoundingClientRect();return {inside:g.top>=v.top&&g.bottom<=v.bottom&&g.left>=v.left&&g.right<=v.right,ratio:g.width/g.height}})()');
        assert.ok(geometry.inside,'Guide must fit video at '+width);
        assert.ok(Math.abs(geometry.ratio-5/7)<0.02,'Card guide aspect ratio');
      }
      const actual=await evaluate('document.documentElement.scrollWidth');
      assert.ok(actual<=width,section+' at '+width+' overflows to '+actual);
    }
  }
  assert.deepEqual(JSON.parse(await evaluate('localStorage.getItem("pokeledger-v1")')),fixture);
});
