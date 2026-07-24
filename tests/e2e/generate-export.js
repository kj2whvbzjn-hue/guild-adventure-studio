#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const core=require('../../export-core.js');
const data=require('./minimum-data.js');
const out=process.argv[2]; if(!out)throw new Error('output directory required');
(async()=>{const pkg=await core.buildPackage(data,{dataVersion:'e2e-1.0.0',generatedAt:'2026-07-23T21:00:00+09:00',appVersion:'1.14.0'});fs.rmSync(out,{recursive:true,force:true});for(const [rel,text] of Object.entries(pkg.files)){const p=path.join(out,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text,'utf8');}console.log(JSON.stringify({ok:true,files:Object.keys(pkg.files).length}));})().catch(e=>{console.error(e);process.exit(1)});
