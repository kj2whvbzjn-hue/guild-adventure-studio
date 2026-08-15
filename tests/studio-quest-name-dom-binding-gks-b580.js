const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const html=fs.readFileSync('studio/index.html','utf8');

function extractFunction(name){
  const marker=`function ${name}(`,start=html.indexOf(marker);
  assert.ok(start>=0,`missing ${name}`);
  const brace=html.indexOf('{',start);let depth=0,quote=null,escape=false;
  for(let i=brace;i<html.length;i++){
    const ch=html[i];
    if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)quote=null;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}
function field(value=''){return {value};}

assert.ok(!html.includes('function questName('),'Quest display helper must not collide with <input id="questName">');
assert.ok(html.includes('function questDisplayName('),'Quest display-name lookup helper must use a distinct identifier');
assert.ok(html.includes("const questName=document.getElementById('questName');\n const id=questId.value.trim()"),'saveQuest must bind the actual Quest-name DOM input');
assert.ok(html.includes("const q=data.quests.find(x=>x.id===id),questName=document.getElementById('questName')"),'editQuest must bind the actual Quest-name DOM input');

const questNameInput=field('STALE-FORM-VALUE');
const q={
  id:'QST-CH01-SEC01',name:'1-1 新たな訓練の日',type:'main',status:'draft',summary:'summary',conditions:'',completion:'',failure:'',rewards:'',
  adventure_duration_seconds:300,base_enemy_budget:0,start_cost:{gold:0,resources:{}},context:{map_id:'',environment_tags:[]},
  prerequisite_ids:[],next_quest_ids:[],required_flags:[],set_flags:[],links:{character_ids:[]},boxes:[]
};
const ctx={
  console,
  document:{getElementById(id){return id==='questName'?questNameInput:null;}},
  window:{},
  data:{quests:[q]},
  questId:field(),questType:field(),questStatus:field(),questSummary:field(),questConditions:field(),questCompletion:field(),questFailure:field(),questRewards:field(),
  questAdventureDuration:field(),questEnemyBudget:field(),questEnvironmentTags:field(),questStartCostGold:field(),questStartCostResources:field(),
  questPrerequisites:field(),questNextQuests:field(),questRequiredFlags:field(),questSetFlags:field(),questChapterLink:field(),questSectionLink:field(),questSceneLink:field(),
  questDraftCharacterIds:[],questDraftBoxes:[],
  refreshQuestMapOptions(){},refreshLinkSelectors(){},renderDraftCharacterChips(){},renderQuestBoxDraftList(){},renderQuestFormalStatus(){},showView(){},openStudioInputPanel(){},
  questBoxClone(x){return {...x};}
};
vm.createContext(ctx);
vm.runInContext(extractFunction('editQuest'),ctx);
vm.runInContext(extractFunction('currentQuestFormalDraft'),ctx);

ctx.editQuest(q.id);
assert.strictEqual(questNameInput.value,q.name,'editing an imported Quest must show the same persisted name as the Quest list');
questNameInput.value='1-1 新たな訓練の日・改';
const draft=ctx.currentQuestFormalDraft();
assert.strictEqual(draft.name,'1-1 新たな訓練の日・改','re-changing Quest name must read the actual edited DOM value, not imported/stale helper state');

console.log('PASS GKS-B582 Quest-name DOM binding: list/edit name parity and re-change use the real questName input without helper-name collision');
