'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const core=require('../assets/shared/js/adventure-battle-core.js');

let checks=0;
function ok(value,message){assert.ok(value,message);checks++;}
function no(re,text,message){assert.ok(!re.test(text),message);checks++;}

const app=read('game/assets/js/app-runtime.js');
const battle=read('game/assets/js/battle-control.js');
const studio=read('studio/index.html');
const tagRuntime=read('game/assets/js/tag-skill-runtime.js');
const adventureCore=read('assets/shared/js/adventure-battle-core.js');

// Current Player path: old Demo Actor formulas/config owner must stay absent.
no(/\bbattle_actor\b/,app,'Game Runtime must not read legacy battle_actor');
no(/STR[^ \n]*\s*\*\s*3|VIT[^ \n]*\s*\*\s*20/i,app,'legacy Player actor coefficients must not return');

// Formal Combat fixed defaults: legal zero must not be rewritten to old Demo values.
no(/formalGenerated\s*\?\s*row\.maxMp\s*:\s*100/,battle,'Formal Adventure Monster MP fallback must be absent');
ok(/formalMode\?formalBattleRequiredNumber\(u\.attack,[\s\S]{0,140}\{min:0\}\)/.test(studio),'Studio Formal attack must use required-number ingestion');
ok(/formalMode\?formalBattleRequiredNumber\(u\.agi,[\s\S]{0,140}\{min:0\}\)/.test(studio),'Studio Formal AGI must use required-number ingestion');
ok(/formalMode\?formalBattleRequiredNumber\(u\.hp\?\?u\.maxHp\?\?u\.max_hp,[\s\S]{0,140}\{min:1\}\)/.test(studio),'Studio Formal HP must use required-number ingestion');

// Abolished Current Range must not be accepted by Game runtime.
no(/PIERCE\s*:\s*['"]pierce['"]/i,tagRuntime,'PIERCE runtime mapping must be absent');

// monsterStats is Production-reachable through expandFormation, therefore non-Formal fallback must fail closed.
no(/\|\|\s*100|\|\|\s*10/,adventureCore.match(/function monsterStats[\s\S]*?function expandFormation/)?.[0]||'','monsterStats fixed 100/10 fallback must be absent');
assert.throws(
  ()=>core.monsterStats({id:'LEGACY-DEMO',params:{maxHp:0,attack:0,agi:0}}),
  e=>e&&e.code==='NON_FORMAL_MONSTER_NOT_ALLOWED',
  'non-Formal Monster must fail closed'
); checks++;

// Legal zero values are preserved for Formal Monster fields where zero is valid.
const zero=core.monsterStats({
  id:'FORMAL-ZERO', params:{job_code:'SWD',level:1,maxHp:1,maxMp:0,attack:0,agi:0}
});
assert.strictEqual(zero.maxMp,0); checks++;
assert.strictEqual(zero.attack,0); checks++;
assert.strictEqual(zero.agi,0); checks++;
assert.strictEqual(zero.formalGenerated,true); checks++;

// Missing required Formal values fail closed rather than selecting a fixed fallback.
assert.throws(
  ()=>core.monsterStats({id:'FORMAL-MISSING',params:{job_code:'SWD',level:1,maxHp:1,attack:0,agi:0}}),
  /不正です/,
  'missing Formal maxMp must fail closed'
); checks++;

console.log(`LBRC_LEGACY_ZERO_GATE_OK checks=${checks}`);
