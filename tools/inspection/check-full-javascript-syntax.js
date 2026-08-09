#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(process.argv[2]||path.resolve(__dirname,'../..'));
const files=[];
function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(ent.name==='.git'||ent.name==='vendor'||ent.name==='node_modules') continue;
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(p);
    else if(ent.isFile()&&ent.name.endsWith('.js')&&ent.name!=='jszip.min.js') files.push(p);
  }
}
walk(root); files.sort();
const errors=[];
for(const file of files){
  try{new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});}
  catch(e){errors.push(`${path.relative(root,file)}: ${e.message}`);}
}
if(errors.length){console.error('JAVASCRIPT_SYNTAX_FAIL');for(const e of errors)console.error(e);process.exit(1);}
console.log(`JAVASCRIPT_SYNTAX_OK files=${files.length}`);
