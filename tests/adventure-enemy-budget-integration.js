const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const Story=require(path.join(root,'assets/shared/js/adventure-story-system.js'));
const studio=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
const runtime=fs.readFileSync(path.join(root,'game/assets/js/app-runtime.js'),'utf8');
const Export=require(path.join(root,'export-core.js'));

// Budget rule: Quest > 0 overrides Section; consumed tablet resources add their master bonus.
const tablets=[{id:'TBL-A',params:{enemy_budget_bonus:2}},{id:'TBL-B',enemy_budget_bonus:5}];
assert.equal(Story.resolveEnemyBudget({quest:{enemy_budget:8},section:{enemy_budget:4},startCostResources:{'TBL-A':2,'OTHER':99},tablets}),12);
assert.equal(Story.resolveEnemyBudget({quest:{enemy_budget:0},section:{enemy_budget:4},startCostResources:{'TBL-B':1},tablets}),9);
assert.equal(Story.monsterBudgetCost({params:{enemy_budget_cost:3}}),3);
assert.equal(Story.tabletEnemyBudgetBonus({params:{enemy_budget_bonus:2}}),2);

// Generated formation never exceeds budget and only uses Chapter candidates.
const generated=Story.generateRandomBattle({budget:7,monsterIds:['M-A','M-B'],monsters:[{id:'M-A',params:{enemy_budget_cost:2}},{id:'M-B',params:{enemy_budget_cost:5}},{id:'M-X',params:{enemy_budget_cost:1}}],random:Story.rng(42)});
const spent=generated.formation.reduce((sum,row)=>sum+Story.monsterBudgetCost([{id:'M-A',params:{enemy_budget_cost:2}},{id:'M-B',params:{enemy_budget_cost:5}}].find(x=>x.id===row.monster_id))*row.count,0);
assert(spent<=7);
assert(generated.formation.every(row=>['M-A','M-B'].includes(row.monster_id)));

// Studio has explicit authoring fields and validation for all budget inputs.
for(const marker of ['id="questEnemyBudget"','id="storyEnemyBudget"','id="masterEnemyBudgetCost"','id="masterEnemyBudgetBonus"','使用可能Monsterが存在しません','Enemy Budget Costが不正です','Enemy Budget Bonusが不正です'])assert(studio.includes(marker),`Studio marker missing: ${marker}`);

// Runtime loads Stone Master and resolves budget from consumed start-cost tablets once at simulation start.
assert(runtime.includes("tablets:'../Export/stone/stones.json'"));
assert(runtime.includes('GKAdventureStorySystem.resolveEnemyBudget'));
assert(runtime.includes('startCostResources:startCostResult?.cost?.resources||{}'));
assert(runtime.includes('enemyBudget:args=>adventureEnemyBudget'));

// Export preserves Quest/Section budget and Monster/Tablet params without a parallel model.
const data={quests:[{id:'Q-B',type:'main',enemy_budget:9}],chapters:[{id:'C-B',sections:[{id:'S-B',enemy_budget:6,boxes:[{id:'B1',type:'random_battle'}],scenes:[]}]}],events:[],flags:[],masters:{monsters:[{id:'M-A',params:{enemy_budget_cost:3}}],tablets:[{id:'TBL-A',params:{enemy_budget_bonus:2}}]}};
const out=Export.buildData(data);
assert.equal(out['quest/main_quests.json'][0].enemy_budget,9);
assert.equal(out['scenario/sections.json'][0].enemy_budget,6);
assert.equal(out['monster/monsters.json'][0].params.enemy_budget_cost,3);
assert.equal(out['stone/stones.json'][0].params.enemy_budget_bonus,2);
console.log('ADVENTURE_ENEMY_BUDGET_INTEGRATION_PASS');
