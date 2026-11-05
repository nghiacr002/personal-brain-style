import {existsSync,lstatSync,readdirSync,readFileSync,realpathSync} from "node:fs";
import {extname,isAbsolute,join,relative,resolve,sep} from "node:path";
import {createHash} from "node:crypto";
import {BrainError} from "../core/models.ts";

const ignored=new Set(["node_modules","vendor","bin","obj","dist","build","coverage","target",".git",".run",".aws",".ssh",".device-secrets"]);
const extensions=new Set([".md",".ts",".tsx",".js",".jsx",".mjs",".cjs",".cs",".csproj",".slnx",".props",".targets",".py",".go",".rs",".java",".kt",".sql",".graphql",".proto",".yaml",".yml",".json",".toml",".xml",".tf",".sh",".css",".scss",".html"]);
function allowed(file:string){
 const parts=file.split(/[\\/]/),name=parts.at(-1)!;
 return !parts.some(p=>ignored.has(p)||/^\.(?!github$|agents$|codex$|claude$)/.test(p)||/^(secrets?|credentials?|passwords?|tokens?|private[-_.]?keys?)$/i.test(p))&&
  !/secret|credential|password|private[-_.]?key|lock\.(json|yaml)$|package-lock|appsettings\..+\.json$/i.test(name)&&
  (extensions.has(extname(name))||name==="Dockerfile");
}
export function readRepositoryEvidence(folder:string,file:string){
 if(!file||isAbsolute(file)||file.split(/[\\/]/).includes("..")||!allowed(file))throw new BrainError("Unsupported repository evidence path: "+file);
 const root=realpathSync(folder),path=resolve(root,file),real=realpathSync(path);
 const rel=relative(root,real);
 if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)||relative(path,real)!=='')throw new BrainError("Evidence must be a regular file inside the linked repository");
 const stat=lstatSync(real);if(!stat.isFile()||stat.size>65536)throw new BrainError("Evidence file must be regular text of at most 64 KiB: "+file);
 const content=readFileSync(real,"utf8");if(content.includes("\0"))throw new BrainError("Binary evidence is not supported");
 return {file:relative(root,real).split(sep).join("/"),digest:createHash("sha256").update(content).digest("hex"),content};
}
export function repositoryEvidence(folder:string,requested?:string[],offset=0){
 if(requested!==undefined&&(!Array.isArray(requested)||requested.length>8||requested.some(p=>typeof p!=="string")))throw new BrainError("Request at most 8 repository files");
 if(!Number.isInteger(offset)||offset<0)throw new BrainError("Invalid file offset");
 const files:string[]=[],issues:Array<{type:string;message:string}>=[];let visited=0,truncated=false;
 function walk(dir:string,depth:number){
  if(depth>12||visited>=10000){truncated=true;return;}
  let entries;try{entries=readdirSync(dir,{withFileTypes:true}).sort((a,b)=>Number(a.isDirectory())-Number(b.isDirectory())||a.name.localeCompare(b.name));}catch{issues.push({type:"evidence",message:"Cannot list "+relative(folder,dir)});return;}
  for(const entry of entries){
   if(++visited>10000){truncated=true;break;}
   if(entry.isSymbolicLink()||ignored.has(entry.name)||(entry.name.startsWith(".")&&entry.name!==".github"))continue;
   const path=join(dir,entry.name),file=relative(folder,path).split(sep).join("/");
   if(entry.isDirectory())walk(path,depth+1);else if(entry.isFile()&&allowed(file))files.push(file);
  }
 }
 walk(folder,0);
 const defaults=["AGENTS.md","CLAUDE.md","README.md","package.json","global.json","Directory.Build.props","Directory.Packages.props","pnpm-workspace.yaml"].filter(file=>existsSync(join(folder,file)));
 const evidence:ReturnType<typeof readRepositoryEvidence>[]=[];let chars=0;
 for(const file of requested||defaults){
  try{const item=readRepositoryEvidence(folder,file);if(chars+item.content.length>100000){issues.push({type:"evidence-limit",message:"Evidence budget reached; request fewer files."});break;}evidence.push(item);chars+=item.content.length;}
  catch(e){issues.push({type:"evidence",message:e instanceof Error?e.message:String(e)});}
 }
 return {files:files.slice(offset,offset+200),totalFiles:files.length,nextOffset:offset+200<files.length?offset+200:null,truncated,evidence,issues};
}
