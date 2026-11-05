import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {spawnSync} from "node:child_process";

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
