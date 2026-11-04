import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const pkg=JSON.parse(readFileSync('package.json','utf8'));
const tarball=resolve(`${pkg.name}-${pkg.version}.tgz`);
const dir=mkdtempSync(join(tmpdir(),'personal-brain-package-'));
const env={...process.env,PB_HOME:join(dir,'data'),PB_PROJECT_ID:''};
function run(command,args){
  const result=spawnSync(command,args,{cwd:dir,env,encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,result.stderr||String(result.error));return result.stdout;
}
try{
  run('npm',['install','--prefix',dir,'--cache',join(dir,'cache'),'--offline','--ignore-scripts','--no-audit','--no-fund',tarball]);
  const installed=join(dir,'node_modules',pkg.name);
  const bin=join(installed,pkg.bin['personal-brain']);
  assert.equal(run(process.execPath,[bin,'--version']).trim(),pkg.version);
  const doctor=JSON.parse(run(process.execPath,[bin,'doctor']));
  assert.equal(doctor.dataDir,env.PB_HOME);
  assert.match(doctor.mcpRegistration.codex,/cli\.js/);
  const mcp=spawnSync(process.execPath,[bin,'mcp'],{cwd:dir,env,encoding:'utf8',timeout:10000,input:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{}})+'\n'});
  assert.equal(mcp.status,0,mcp.stderr);
  assert.equal(JSON.parse(mcp.stdout).result.serverInfo.name,'personal-brain-style');
  run(process.execPath,['--input-type=module','-e',`import {BrainDB} from ${JSON.stringify(join(installed,'dist/src/core/database.js'))};import {createBrainHttpServer} from ${JSON.stringify(join(installed,'dist/src/server/http.js'))};const db=new BrainDB();const server=createBrainHttpServer(db);if(db.projects().length)throw Error('Unexpected bundled projects');
const response=await new Promise(resolve=>server.emit('request',{url:'/',method:'GET',headers:{}},{setHeader(){},writeHead(status){if(status!==200)throw Error('Static asset response '+status);},end(body){resolve(String(body));}}));
if(!response.includes('app.js'))throw Error('Missing packaged browser UI');
server.close();db.close();`]);
  run(process.execPath,['--input-type=module','-e',`import {hookCommand} from ${JSON.stringify(join(installed,'dist/src/agents/hook-install.js'))};import {existsSync} from 'node:fs';const command=hookCommand('codex','session');for(const part of command.matchAll(/'([^']+)'/g)){if(!existsSync(part[1]))throw Error('Missing hook executable: '+part[1]);}if(!command.includes('cli.js'))throw Error('Hook points to TypeScript');`]);
  console.log('Packed installation, CLI, MCP, hook paths, static assets and clean workspace startup passed.');
}finally{rmSync(dir,{recursive:true,force:true});}
