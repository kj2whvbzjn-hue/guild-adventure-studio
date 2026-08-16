const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const Story=require(path.join(root,'assets/shared/js/adventure-story-system.js'));
const studio=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
const runtime=fs.readFileSync(path.join(root,'game/assets/js/app-runtime.js'),'utf8');
const Export=require(path.join(root,'export-core.js'));

// Formal budget rule: Quest owns the budget; consumed tablet resources add their master bonus.
const tablets=[{id:'TBL-A',params:{enemy_budget_bonus:2}},{id:'TBL-B',enemy_budget_bonus:5}];
assert.equal(Story.resolveEnemyBudget({quest:{enemy_budget:8},section:{enemy_budget:4},startCostResources:{'TBL-A':2,'OTHER':99},tablets}),12);
assert.equal(Story.resolveEnemyBudget({quest:{enemy_budget:4},startCostResources:{'TBL-B':1},tablets}),9);
assert.equal(Story.monsterBudgetCost({params:{enemy_budget_cost:3}}),3);
assert.equal(Story.tabletEnemyBudgetBonus({params:{enemy_budget_bonus:2}}),2);

// Generated formation never exceeds budget and only uses Chapter candidates.
const generated=Story.generateRandomBattle({budget:7,monsterIds:['M-A','M-B'],monsters:[{id:'M-A',params:{enemy_budget_cost:2}},{id:'M-B',params:{enemy_budget_cost:5}},{id:'M-X',params:{enemy_budget_cost:1}}],random:Story.rng(42)});
const spent=generated.formation.reduce((sum,row)=>sum+Story.monsterBudgetCost([{id:'M-A',params:{enemy_budget_cost:2}},{id:'M-B',params:{enemy_budget_cost:5}}].find(x=>x.id===row.monster_id))*row.count,0);
assert(spent<=7);
assert(generated.formation.every(row=>['M-A','M-B'].includes(row.monster_id)));

// Studio authors budget only on Quest/Master. Legacy Section budget UI is removed.
for(const marker of ['id="questEnemyBudget"','id="masterEnemyBudgetCost"','id="masterEnemyBudgetBonus"','Enemy Budget Costが不正です','Enemy Budget Bonusが不正です'])assert(studio.includes(marker),`Studio marker missing: ${marker}`);
assert(!studio.includes('id="storyEnemyBudget"'),'legacy Section enemy_budget editor must be removed');

// P5 keeps legacy budget helpers/data for P7 but the new Quest Box executor no longer consumes Section/Chapter budget.
assert(runtime.includes("tablets:'../Export/stone/stones.json'"));
assert(runtime.includes('GKAdventureStorySystem.resolveEnemyBudget'));
assert(runtime.includes('startCostResources:startCostResult?.cost?.resources||{}'));
assert(!runtime.includes('enemyBudget:args=>adventureEnemyBudget'),'P5 Quest Box execution must not use the legacy random_battle budget path');

// Export preserves Quest budget and Monster/Tablet params, while stripping legacy Section budget.
const data={quests:[{id:'Q-B',type:'main',enemy_budget:9}],chapters:[{id:'C-B',sections:[{id:'S-B',enemy_budget:6,boxes:[{id:'B1',type:'random_battle'}],scenes:[]}]}],events:[],flags:[],masters:{monsters:[{id:'M-A',params:{enemy_budget_cost:3}}],tablets:[{id:'TBL-A',params:{enemy_budget_bonus:2}}]}};
const out=Export.buildData(data);
assert.equal(out['quest/main_quests.json'][0].enemy_budget,9);
assert.equal(Object.prototype.hasOwnProperty.call(out['scenario/sections.json'][0],'enemy_budget'),false);
assert.equal(out['monster/monsters.json'][0].params.enemy_budget_cost,3);
assert.equal(out['stone/stones.json'][0].params.enemy_budget_bonus,2);
console.log('ADVENTURE_ENEMY_BUDGET_INTEGRATION_PASS');
