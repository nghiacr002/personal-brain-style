import assert from 'node:assert/strict';
import {dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, readFileSync, realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {join, resolve} from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const tarball = resolve(`${pkg.name}-${pkg.version}.tgz`);
const dir = mkdtempSync(join(tmpdir(), 'personal-brain-package-'));
// ESM import() needs file:// URLs; Windows drive paths are rejected.
const moduleUrl = (file) => JSON.stringify(pathToFileURL(file).href);
const env = {...process.env, PB_HOME: join(dir, 'data'), PB_PROJECT_ID: ''};
function run(command, args) {
  const result = spawnSync(command, args, {cwd: dir, env, encoding: 'utf8', timeout: 30000});
  assert.equal(result.status, 0, result.stderr || String(result.error));
  return result.stdout;
}
try {
  const npmArgs =
    process.platform === 'win32'
      ? [
          process.env.npm_execpath ||
            join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
        ]
      : [];
  run(process.platform === 'win32' ? process.execPath : 'npm', [
    ...npmArgs,
    'install',
    '--prefix',
    dir,
    '--cache',
    join(dir, 'cache'),
    '--offline',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    tarball,
  ]);
  const installed = join(dir, 'node_modules', pkg.name);
  const bin = join(installed, pkg.bin['personal-brain']);
  assert.equal(run(process.execPath, [bin, '--version']).trim(), pkg.version);
  const desktopFile = join(dir, 'desktop-config.json');
  run(process.execPath, [bin, 'desktop', 'repair', '--config', desktopFile]);
  const desktop = JSON.parse(readFileSync(desktopFile, 'utf8')).mcpServers['personal-brain'];
  assert.equal(desktop.command, process.execPath);
  assert.equal(realpathSync(desktop.args[1]), realpathSync(join(installed, 'dist/src/cli.js')));
  assert.equal(
    JSON.parse(run(process.execPath, [bin, 'desktop', 'status', '--config', desktopFile])).owned,
    true,
  );
  const doctor = JSON.parse(run(process.execPath, [bin, 'doctor']));
  assert.equal(doctor.dataDir, env.PB_HOME);
  assert.match(doctor.mcpRegistration.codex, /cli\.js/);
  const mcp = spawnSync(process.execPath, [bin, 'mcp'], {
    cwd: dir,
    env,
    encoding: 'utf8',
    timeout: 10000,
    input:
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {protocolVersion: '2025-11-25'},
      }) + '\n',
  });
  assert.equal(mcp.status, 0, mcp.stderr);
  assert.equal(JSON.parse(mcp.stdout).result.serverInfo.name, 'personal-brain-style');
  assert.equal(JSON.parse(mcp.stdout).result.serverInfo.version, pkg.version);
  assert.equal(doctor.delivery.agents[0].stages.retrieval.status, 'unknown');
  run(process.execPath, [
    '--input-type=module',
    '-e',
    `import {BrainDB} from ${moduleUrl(join(installed, 'dist/src/core/database.js'))};import {createBrainHttpServer} from ${moduleUrl(join(installed, 'dist/src/server/http.js'))};const db=new BrainDB();const server=createBrainHttpServer(db);if(db.projects().length)throw Error('Unexpected bundled projects');
const response=await new Promise(resolve=>server.emit('request',{url:'/',method:'GET',headers:{}},{setHeader(){},writeHead(status){if(status!==200)throw Error('Static asset response '+status);},end(body){resolve(String(body));}}));
if(!response.includes('app.js'))throw Error('Missing packaged browser UI');
const project=db.saveProject({name:'Package check',description:'',assignments:[]});
const setup=JSON.parse(await new Promise(resolve=>server.emit('request',{url:'/api/chatgpt/setup?projectId='+project.id,method:'GET',headers:{}},{setHeader(){},writeHead(status){if(status!==200)throw Error('Setup response '+status);},end(body){resolve(String(body));}})));
const {existsSync}=await import('node:fs');
if(setup.connectCommand!=='personal-brain chatgpt-connect '+project.id)throw Error('Invalid installed connect command');
for(const command of [setup.command,setup.connectRaw]){
 if(command.includes('cli.ts')||!/dist[\\\\/]src[\\\\/]cli\\.js/.test(command))throw Error('Setup must use compiled CLI');
 for(const match of command.matchAll(/'([^']+)'/g)){if(/[\\\\/]/.test(match[1])&&!existsSync(match[1]))throw Error('Missing setup executable: '+match[1]);}
}
if(!existsSync(${JSON.stringify(join(installed, 'dist/scripts/connect-chatgpt.sh'))}))throw Error('Missing packaged tunnel helper');

server.close();db.close();`,
  ]);
  run(process.execPath, [
    '--input-type=module',
    '-e',
    `import {hookCommand} from ${moduleUrl(join(installed, 'dist/src/agents/hook-install.js'))};import {existsSync} from 'node:fs';let command=hookCommand('codex','session');const encoded=command.match(/-EncodedCommand (\\S+)$/);if(encoded){command=Buffer.from(encoded[1],'base64').toString('utf16le');}for(const part of command.matchAll(/'([^']+)'/g)){if(/[\\\\/]/.test(part[1])&&!existsSync(part[1]))throw Error('Missing hook executable: '+part[1]);}if(!command.includes('cli.js'))throw Error('Hook points to TypeScript');`,
  ]);
  console.log(
    'Packed installation, CLI, MCP, hook paths, static assets and clean workspace startup passed.',
  );
} finally {
  rmSync(dir, {recursive: true, force: true});
}
