#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'); const root=process.argv[2];
function data(rel){return JSON.parse(fs.readFileSync(path.join(root,rel),'utf8')).data;}
const checks=[
 ['chapter',data('scenario/chapters.json')[0].name==='平原の章'],
 ['section link',data('scenario/sections.json')[0].chapter_id==='CH001'],
 ['scene text',data('scenario/scenes.json')[0].text==='日本語・改行\n記号「」を保持'],
 ['job',data('master/jobs.json')[0].vit===13],
 ['quest',data('quest/main_quests.json')[0].monster_id==='MON001'],
 ['equipment mod split',data('equipment/mods.json')[0].id==='MOD001'],
 ['monster mod split',data('monster/monster_mods.json')[0].id==='MMOD001'],
 ['stone mod split',data('stone/stone_mods.json')[0].id==='SMOD001']
];
for(const [name,ok] of checks)console.log((ok?'[PASS] ':'[FAIL] ')+name);
if(checks.some(x=>!x[1]))process.exit(1);
