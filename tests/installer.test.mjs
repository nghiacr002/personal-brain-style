import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {spawnSync} from "node:child_process";

test("activation includes OpenCode in preview, install, repair, status and removal",{skip:process.platform==='win32'?'POSIX shell fixture; run on macOS CI':false},()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-activation-"));
 try{
  // Intercept every runtime/host call so the script cannot touch personal settings.
  writeFileSync(join(dir,'node'),`#!/bin/bash
if [[ "$1" == *select-node.mjs ]]; then printf '%s\\n' "$TEST_DIR/node"
elif [[ "$1" == --version ]]; then echo v22.23.4
else printf '%s\\n' "$*" >> "$TEST_DIR/calls"; exit "\${TEST_EXIT:-0}"
fi
`,{mode:0o755});
  for(const name of ['claude','codex'])writeFileSync(join(dir,name),'#!/bin/bash\necho "Existing foreign registration"\n',{mode:0o755});
  const env={...process.env,PATH:dir+':'+process.env.PATH,TEST_DIR:dir};
  for(const [flag,action] of [['','status'],['--apply','install'],['--repair','install'],['--status','status'],['--remove','remove']]){
   rmSync(join(dir,'calls'),{force:true});
   const result=spawnSync('bash',['scripts/activate-personal-brain.sh',...(flag?[flag]:[])],{env,encoding:'utf8'});
   assert.equal(result.status,0,result.stderr);
   const calls=readFileSync(join(dir,'calls'),'utf8');
   assert.match(calls,new RegExp(`hooks ${action} all`));assert.doesNotMatch(calls,/hooks .* both/);
   if(!flag)assert.doesNotMatch(calls,/hooks (install|remove)/);
   if(flag==='--apply'||flag==='--repair')assert.match(result.stdout,/Restart Claude, Codex and OpenCode/);
  }
  const failed=spawnSync('bash',['scripts/activate-personal-brain.sh','--apply'],{env:{...env,TEST_EXIT:'3'},encoding:'utf8'});
  assert.equal(failed.status,3);assert.doesNotMatch(failed.stdout,/Done\./);
  rmSync(join(dir,'calls'));
  const desktop=spawnSync('bash',['scripts/activate-personal-brain.sh','--status','--desktop'],{env,encoding:'utf8'});
  assert.equal(desktop.status,0,desktop.stderr);assert.match(readFileSync(join(dir,'calls'),'utf8'),/desktop status/);
  assert.doesNotMatch(readFileSync(join(dir,'calls'),'utf8'),/hooks/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test("installer rejects unsupported override before registration and repairs only its own MCP entries",{skip:process.platform==='win32'?'POSIX shell fixture; run on macOS CI':false},()=>{
 const dir=mkdtempSync(join(tmpdir(),"pb-installer-"));
 try{
  const mock=`#!/bin/bash
name="\${0##*/}"
if [[ "$2" == get ]]; then
  [[ -f "$TEST_DIR/$name-removed" ]] && exit 1
  echo "Command: /old/node"
  echo "Args: $TEST_RUNNER"
elif [[ "$2" == remove ]]; then
  touch "$TEST_DIR/$name-removed"
  echo "$name remove" >> "$TEST_DIR/calls"
else
  echo "$name $*" >> "$TEST_DIR/calls"
fi
`;
  for(const name of ["claude","codex"])writeFileSync(join(dir,name),mock,{mode:0o755});
  const env={...process.env,PATH:dir+":"+process.env.PATH,TEST_DIR:dir,TEST_RUNNER:resolve("scripts/run.mjs")};
  const bad=spawnSync("bash",["scripts/connect-macos.sh","--apply"],{env:{...env,PB_NODE:"/not/a/node"},encoding:"utf8"});
  assert.notEqual(bad.status,0);assert.equal(existsSync(join(dir,"calls")),false);
  const repair=spawnSync("bash",["scripts/connect-macos.sh","--repair"],{env:{...env,PB_NODE:process.execPath},encoding:"utf8"});
  assert.equal(repair.status,0,repair.stderr);
  const log=readFileSync(join(dir,"calls"),"utf8");
  assert.match(log,/claude remove/);assert.match(log,/codex remove/);assert.ok(log.includes(process.execPath));
  assert.match(log,/mcp claude/);assert.match(log,/mcp codex/);
  for(const name of ["claude","codex"])rmSync(join(dir,name+"-removed"));rmSync(join(dir,"calls"));
  const foreign=spawnSync("bash",["scripts/connect-macos.sh","--repair"],{env:{...env,PB_NODE:process.execPath,TEST_RUNNER:"/different/installation/run.mjs"},encoding:"utf8"});
  assert.equal(foreign.status,0);assert.equal(existsSync(join(dir,"calls")),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
