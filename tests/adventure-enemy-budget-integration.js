const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const Story=require(path.join(root,'assets/shared/js/adventure-story-system.js'));
const studio=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
const runtime=fs.readFileSync(path.join(root,'game/assets/js/app-runtime.js'),'utf8');
const Export=require(path.join(root,'studio/export-core.js'));

// Formal budget rule: Quest alone owns Enemy Budget; consumed tablet resources may add their master bonus.
const tablets=[{id:'TBL-A',params:{enemy_budget_bonus:2}},{id:'TBL-B',enemy_budget_bonus:5}];
assert.equal(Story.resolveEnemyBudget({quest:{base_enemy_budget:8},startCostResources:{'TBL-A':2,'OTHER':99},tablets}),12);
assert.equal(Story.resolveEnemyBudget({quest:{enemy_budget:4},startCostResources:{'TBL-B':1},tablets}),9);
assert.equal(Story.resolveEnemyBudget({quest:{base_enemy_budget:0},startCostResources:{},tablets}),0);
assert.equal(Story.tabletEnemyBudgetBonus({params:{enemy_budget_bonus:2}}),2);
assert.equal(typeof Story.monsterBudgetCost,'undefined','retired Section random-battle helper must not remain public');
assert.equal(typeof Story.generateRandomBattle,'undefined','retired Section random-battle generator must be removed');

// Studio authors budget only on Quest/Master. Legacy Section budget UI is removed.
for(const marker of ['id="questEnemyBudget"','id="masterEnemyBudgetCost"','id="masterEnemyBudgetBonus"','Enemy Budget Costが不正です','Enemy Budget Bonusが不正です'])assert(studio.includes(marker),`Studio marker missing: ${marker}`);
assert(!studio.includes('id="storyEnemyBudget"'),'retired Section enemy_budget editor must be removed');
assert(!runtime.includes('function adventureEnemyBudget('),'unused Game compatibility wrapper must be removed');
assert(!Story.resolveEnemyBudget.toString().includes('section'),'Enemy Budget resolver must not accept a Section fallback');

// Safety is retained: retired Section fields are rejected by the formal export gate instead of silently stripped.
const retired={quests:[],events:[],chapters:[{id:'C-OLD',sections:[{id:'S-OLD',enemy_budget:6,scenes:[]}]}],masters:{}};
const retiredIssues=Export.collectRetiredStoryModelIssues(retired);
assert(retiredIssues.some(x=>x.level==='ERROR'&&x.code==='RETIRED_SECTION_FIELD'&&x.field==='enemy_budget'));

// Formal Export preserves Quest budget and Monster/Tablet params without relying on Section compatibility fields.
const data={quests:[{id:'Q-B',name:'Budget',type:'main',adventure_duration_seconds:30,base_enemy_budget:9,enemy_budget:9,boxes:[]}],chapters:[{id:'C-B',sections:[{id:'S-B',scenes:[]}]}],events:[],flags:[],masters:{monsters:[{id:'M-A',params:{enemy_budget_cost:3}}],tablets:[{id:'TBL-A',params:{enemy_budget_bonus:2}}]}};
assert(!Export.collectRetiredStoryModelIssues(data).length);
const out=Export.buildData(data);
assert.equal(out['quest/main_quests.json'][0].enemy_budget,9);
assert.equal(Object.prototype.hasOwnProperty.call(out['scenario/sections.json'][0],'enemy_budget'),false);
assert.equal(out['monster/monsters.json'][0].params.enemy_budget_cost,3);
assert.equal(out['stone/stones.json'][0].params.enemy_budget_bonus,2);
console.log('ADVENTURE_ENEMY_BUDGET_INTEGRATION_PASS');
