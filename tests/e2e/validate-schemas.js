#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'); const dir=process.argv[2];
const map=JSON.parse(fs.readFileSync(path.join(root,'schemas/export-schema-map.json'),'utf8'));
function fail(p,r){throw new Error(`DATA_SCHEMA_INVALID ${p}: ${r}`)}
function validate(v,s,p='$'){if(s.type){const ok={array:Array.isArray(v),object:v&&typeof v==='object'&&!Array.isArray(v),string:typeof v==='string',integer:Number.isInteger(v),number:typeof v==='number'&&Number.isFinite(v),boolean:typeof v==='boolean'}[s.type];if(!ok)fail(p,'type '+s.type)}if(typeof v==='string'){if(s.minLength!=null&&[...v].length<s.minLength)fail(p,'minLength');if(s.enum&&!s.enum.includes(v))fail(p,'enum')}if(typeof v==='number'){if(s.minimum!=null&&v<s.minimum)fail(p,'minimum');if(s.maximum!=null&&v>s.maximum)fail(p,'maximum')}if(Array.isArray(v)){if(s.uniqueItems&&new Set(v.map(JSON.stringify)).size!==v.length)fail(p,'uniqueItems');if(s.items)v.forEach((x,i)=>validate(x,s.items,`${p}[${i}]`))}else if(v&&typeof v==='object'){for(const k of s.required||[])if(!(k in v))fail(`${p}.${k}`,'required');for(const [k,ss] of Object.entries(s.properties||{}))if(k in v)validate(v[k],ss,`${p}.${k}`)}}
for(const [rel,schRel] of Object.entries(map)){const doc=JSON.parse(fs.readFileSync(path.join(dir,rel),'utf8'));const sch=JSON.parse(fs.readFileSync(path.join(root,schRel),'utf8'));validate(doc.data,sch,'$.data')}
console.log(JSON.stringify({ok:true,schemas:Object.keys(map).length}));
