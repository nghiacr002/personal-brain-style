import {readFileSync,writeFileSync,statSync} from "node:fs";
import {dirname,join,isAbsolute,resolve} from "node:path";
import {BrainError} from "../core/models.ts";

function checkFolder(folder:string){
  if(!isAbsolute(folder))throw new BrainError("Repository folder must be an absolute path");
  try{if(!statSync(folder).isDirectory())throw new BrainError("Repository path must be a folder");}
  catch(e){if(e instanceof BrainError)throw e;throw new BrainError("Repository folder does not exist or cannot be accessed: "+folder);}
}

export function resolveProjectScope(explicit?:string,cwd=process.cwd(),environment=process.env.PB_PROJECT_ID) {
  const checked=(id:unknown)=>{if(typeof id!=="string"||!id.trim())throw new BrainError("Project ID must be a non-empty string");return id;};
  if(explicit!==undefined)return {projectId:checked(explicit),source:"Explicit project ID",file:null};
  if(environment)return {projectId:checked(environment),source:"PB_PROJECT_ID",file:null};
  checkFolder(cwd);
  let folder=resolve(cwd);
  while(true){
    const file=join(folder,".personal-brain.json");
    let raw:string;
    try{raw=readFileSync(file,"utf8");}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw new BrainError("Cannot read repository configuration: "+file);const parent=dirname(folder);if(parent===folder)break;folder=parent;continue;}
    try{const data=JSON.parse(raw);return {projectId:checked(data?.projectId),source:"Repository configuration",file};}
    catch{throw new BrainError("Invalid repository configuration: "+file+". Expected a JSON object with projectId.");}
  }
  return {projectId:undefined,source:"Global defaults",file:null};
}
export function linkRepository(folder:string,projectId:string){
  checkFolder(folder);
  const file=join(folder,".personal-brain.json");
  try{writeFileSync(file,JSON.stringify({projectId},null,2)+"\n",{flag:"wx",mode:0o600});}
  catch(e){
    if((e as NodeJS.ErrnoException).code!=="EEXIST")throw e;
    const existing=resolveProjectScope(undefined,folder,"");
    if(existing.projectId!==projectId)throw new BrainError("This folder is already linked to another project. Edit .personal-brain.json explicitly to change it.","CONFLICT",409);
  }
  return {file,projectId};
}
