#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const core=require('../export-core.js');
const text='承認済み本文。王子は身分を隠して近衛騎士団へ入団する。';
const hash=crypto.createHash('sha256').update(text,'utf8').digest('hex');
const base={project:{id:'build329-gate'},chapters:[{id:'CH001',name:'第一章',summary:text,design:{goal:'管理専用'},candidate_revisions:[{id:'REV001',status:'approved',text}],export_control:{ready:true,approved_revision_id:'REV001',canonical_hash:hash},sections:[]}],masters:{},quests:[],events:[],flags:[],ai_templates:[],balance:{},drop_tables:[],game_settings:{}};
assert.deepEqual(core.collectScenarioExportIssues(base),[]);
const rows=core.buildData(base)['scenario/chapters.json'];
assert.equal(rows.length,1);assert.equal(rows[0].summary,text);
assert.equal('candidate_revisions' in rows[0],false);assert.equal('design' in rows[0],false);assert.equal('export_control' in rows[0],false);
const notReady=structuredClone(base);notReady.chapters[0].export_control.ready=false;
assert.equal(core.collectScenarioExportIssues(notReady)[0].code,'SCENARIO_NOT_EXPORT_READY');
const badHash=structuredClone(base);badHash.chapters[0].export_control.canonical_hash='0'.repeat(64);
assert.equal(core.collectScenarioExportIssues(badHash)[0].code,'CANONICAL_HASH_MISMATCH');
const badText=structuredClone(base);badText.chapters[0].summary+='改変';
assert(core.collectScenarioExportIssues(badText).some(x=>x.code==='CANONICAL_TEXT_MISMATCH'));
(async()=>{const pkg=await core.buildPackage(base,{dataVersion:'build329-gate-1',generatedAt:'2026-07-24T08:00:00+09:00',appVersion:'1.23.0-dev'});const exported=JSON.parse(pkg.files['scenario/chapters.json']).data[0];assert.equal(exported.summary,text);assert.equal(exported.candidate_revisions,undefined);console.log('PASS Build 329 approved scenario export gate');})().catch(e=>{console.error(e);process.exit(1)});
