#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'); const root=process.argv[2];
function doc(rel){return JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));}
function data(rel){return doc(rel).data;}
const chapter=data('scenario/chapters.json')[0],scene=data('scenario/scenes.json')[0],quest=data('quest/main_quests.json')[0],aiNodes=doc('ai/ai_nodes.json');
const checks=[
 ['chapter title',chapter.title==='平原の章'],
 ['section link',data('scenario/sections.json')[0].chapter_id==='CH001'],
 ['scene summary',scene.summary==='日本語・改行\n記号「」を保持'],
 ['job',data('master/jobs.json')[0].vit===13],
 ['formal quest boxes',Array.isArray(quest.boxes)&&quest.adventure_duration_seconds===300],
 ['AI node refs envelope',aiNodes.refs&&Array.isArray(aiNodes.refs.tags)&&Array.isArray(aiNodes.refs.tag_categories)],
 ['equipment mod split',data('equipment/mods.json')[0].id==='MOD001'],
 ['monster mod split',data('monster/monster_mods.json')[0].id==='MMOD001'],
 ['stone mod split',data('stone/stone_mods.json')[0].id==='SMOD001']
];
for(const [name,ok] of checks)console.log((ok?'[PASS] ':'[FAIL] ')+name);
if(checks.some(x=>!x[1]))process.exit(1);
