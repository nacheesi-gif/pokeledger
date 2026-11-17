"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const cp=require("node:child_process");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");

test("discipline gate passes for the verified repository",()=>{
 const r=cp.spawnSync("python3",["scripts/discipline_check.py"],{encoding:"utf8"});
 assert.equal(r.status,0,r.stderr+"\n"+r.stdout);
 assert.match(r.stdout,/PASS: discipline gate/);
});

test("discipline gate blocks a repository without a work ledger / declared hooks",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"pokeledger-discipline-"));
 try{
  fs.writeFileSync(path.join(dir,"AGENTS.md"),"Temporary incomplete project\n");
  const r=cp.spawnSync("python3",["scripts/discipline_check.py",dir],{encoding:"utf8"});
  assert.notEqual(r.status,0,"missing required files must reject");
  assert.match(r.stdout,/Required nonempty file missing/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("project-scoped SessionStart hook is read-only and exposes no private data",()=>{
 const r=cp.spawnSync("python3",["scripts/discipline_session.py"],{
  input:JSON.stringify({cwd:process.cwd(),session_id:"private-session-token",source:"compact"}),encoding:"utf8"
 });
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/read AGENTS.md/i);
 assert.doesNotMatch(r.stdout,/private-session-token/);
 assert.match(r.stdout,/WO-001/);
});
