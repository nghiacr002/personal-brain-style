import {existsSync,readdirSync} from "node:fs";
import {join} from "node:path";
import {homedir} from "node:os";
import {spawnSync} from "node:child_process";
import {supported} from "./runtime-compat.mjs";

const nvm=join(process.env.NVM_DIR||join(homedir(),".nvm"),"versions","node");
const candidates=process.env.PB_NODE?[process.env.PB_NODE]:[
  process.execPath,
  ...(existsSync(nvm)?readdirSync(nvm).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})).map(v=>join(nvm,v,"bin","node")):[]),
  "/opt/homebrew/bin/node","/usr/local/bin/node","/usr/bin/node"
];
const chosen=candidates.find(node=>{const check=spawnSync(node,["--version"],{encoding:"utf8"});return check.status===0&&supported(check.stdout.trim());});
if(!chosen){console.error("No supported Node runtime found. Install Node 24 with nvm install 24, or set PB_NODE to a supported Node executable. No settings were changed.");process.exit(1);}
console.log(chosen);
