import {existsSync,readFileSync,mkdirSync,copyFileSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import {dirname,join,resolve,win32,posix} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';

export function desktopConfigPath(platform=process.platform,home=homedir(),env:NodeJS.ProcessEnv=process.env){
 if(platform==='win32')return win32.join(env.APPDATA||win32.join(home,'AppData','Roaming'),'Claude','claude_desktop_config.json');
 if(platform==='darwin')return posix.join(home,'Library','Application Support','Claude','claude_desktop_config.json');
 if(platform==='linux')return posix.join(env.XDG_CONFIG_HOME||posix.join(home,'.config'),'Claude','claude_desktop_config.json');
 throw new Error('Unsupported platform. Supply --config with the Claude Desktop configuration path.');
}
export function configureDesktop(action:string,options:{file?:string;projectId?:string;dataDir:string}){
 if(!['preview','install','repair','remove','status'].includes(action))throw new Error('Use desktop preview|install|repair|remove|status [--project ID] [--config PATH]');
 const file=options.file?resolve(options.file):desktopConfigPath();
 const config=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{};
 if(!config||typeof config!=='object'||Array.isArray(config))throw new Error('Desktop configuration must be a JSON object; no changes made.');
 if(config.mcpServers!==undefined&&(!config.mcpServers||typeof config.mcpServers!=='object'||Array.isArray(config.mcpServers)))throw new Error('mcpServers must be a JSON object; no changes made.');
 const runner=resolve(dirname(fileURLToPath(import.meta.url)),'../../scripts/run.mjs');
 const entry=resolve(dirname(fileURLToPath(import.meta.url)),'../cli.ts');
 const previous=config.mcpServers?.['personal-brain'];
 const owned=previous&&Array.isArray(previous.args)&&previous.args.includes(entry)&&previous.args.includes(runner);
 if(action==='status')return {file,installed:!!previous,owned:!!owned,changed:false};
 if(previous&&!owned)throw new Error('The personal-brain entry belongs to another installation. Review it in Claude Desktop Edit Config before replacing it. No changes made.');
 if(previous?.env!==undefined&&(!previous.env||typeof previous.env!=='object'||Array.isArray(previous.env)))throw new Error('Existing MCP env must be an object; no changes made.');
 const proposed={...previous,command:process.execPath,args:[runner,entry,'mcp','claude'],env:{...previous?.env,PB_HOME:options.dataDir,...(options.projectId?{PB_PROJECT_ID:options.projectId}:{})}};
 if(action==='preview')return {file,changed:false,proposed};
 if(action==='install'&&previous)return {file,installed:true,changed:false,message:'Already installed. Use repair to refresh executable paths or project scope.'};
 const before=JSON.stringify(config);
 if(action==='remove'){if(config.mcpServers)delete config.mcpServers['personal-brain'];}
 else {config.mcpServers??={};config.mcpServers['personal-brain']=proposed;}
 if(JSON.stringify(config)===before)return {file,installed:action!=='remove',changed:false};
 mkdirSync(dirname(file),{recursive:true});
 const backup=existsSync(file)?file+'.personal-brain-backup-'+Date.now():undefined;
 if(backup)copyFileSync(file,backup);
 const temp=file+'.personal-brain-tmp-'+process.pid;
 try{writeFileSync(temp,JSON.stringify(config,null,2)+'\n',{mode:0o600,flag:'wx'});renameSync(temp,file);}finally{if(existsSync(temp))rmSync(temp);}
 return {file,backup,installed:action!=='remove',changed:true,message:'Fully quit and reopen Claude Desktop. Configuration written; connection not yet verified.'};
}
