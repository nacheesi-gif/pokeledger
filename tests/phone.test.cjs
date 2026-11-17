"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = file => fs.readFileSync(file, "utf8");

test("install icons have the advertised pixel dimensions", () => {
  const icons = JSON.parse(read("manifest.webmanifest")).icons;
  for (const n of [180, 192, 512]) {
    const file = "icon-" + n + ".png";
    const bytes = fs.readFileSync(file);
    assert.equal(bytes.readUInt32BE(16), n);
    assert.equal(bytes.readUInt32BE(20), n);
    if (n === 180) assert.ok(read("index.html").includes('href="./' + file + '"'));
    else assert.ok(icons.some(icon => icon.src === file && icon.sizes === n + "x" + n));
    assert.ok(read("sw.js").includes("'./" + file + "'"));
  }
});

for (const [file, start, stop, videoID] of [
  ["scanner.js", "pscStart", "pscStop", "psc-video"],
  ["slabs.js", "slStart", "slStop", "sl-video"]
]) {
  test(file + " releases cancelled requests and failed playback", async () => {
    let grant, ended = 0;
    const video = {pause(){}, play:async () => {}};
    const window = {addEventListener(){}};
    const document = {head:{insertAdjacentHTML(){}},addEventListener(){},getElementById:id => id === videoID ? video : null};
    const navigator = {mediaDevices:{getUserMedia:() => new Promise(resolve => { grant = resolve; })}};
    vm.runInNewContext(read(file), {document,window,navigator});
    const stream = {getTracks:() => [{stop:() => ended++}]};
    const stale = window[start]();
    window[stop]();
    grant(stream);
    await stale;
    assert.equal(ended, 1);
    assert.equal(video.srcObject, null);
    const active = window[start]();
    grant(stream);
    await active;
    assert.equal(video.srcObject, stream);
    window[stop]();
    assert.equal(ended, 2);
    video.play = async () => {throw Error("interrupted")};
    const failed = window[start]();
    grant(stream);
    await failed;
    assert.equal(ended, 3);
    assert.equal(video.srcObject, null);
  });
}

test("backup import preserves original data on invalid input, cancellation and quota errors", async () => {
  const html = read("index.html");
  const fixture = {members:["Family"],cards:[{id:"a"}],transactions:[],statuses:{a:{qty:2}},budget:50};
  const window = {db:fixture, KEY:"pokeledger-v1",loadIssue:"", confirm:()=>true,alert(){},closeModal(){},render(){},scheduleCloudSave(){}};
  let incoming, stored = JSON.stringify(fixture);
  window.document = {getElementById:()=>({files:[{text:async()=>JSON.stringify(incoming)}]})};
  window.localStorage = {setItem:(_, value)=>{stored=value}};
  vm.runInNewContext(html.slice(html.indexOf("function initial()"),html.indexOf("let loadIssue")) +
    html.slice(html.indexOf("function validateSnapshot"),html.indexOf("let db=load")) +
    html.match(/async function doImport\(\)\{[^\n]+/)[0],window);
  for (const statuses of [null, [], "invalid"]) {
    incoming = {...fixture,statuses};
    await window.doImport();
    assert.equal(stored,JSON.stringify(fixture));
    assert.equal(window.db,fixture);
  }
  incoming = {...fixture,members:["Changed"]};
  window.confirm=()=>false;
  await window.doImport();
  assert.equal(window.db,fixture);
  window.confirm=()=>true;
  await window.doImport();
  assert.equal(JSON.parse(stored).statuses.a.qty,2);
  assert.equal(window.db.budgets.hobby,50);
  assert.equal(window.db.members[0],"Changed");
  window.localStorage.setItem=()=>{throw Error("quota")};
  incoming=fixture;
  await window.doImport();
  assert.equal(window.db.members[0],"Changed");
});
