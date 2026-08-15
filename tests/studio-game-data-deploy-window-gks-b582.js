const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('studio/index.html','utf8');

function extractFunction(name){
 const patterns=[`function ${name}(`,`async function ${name}(`];let start=-1;
 for(const p of patterns){start=html.indexOf(p);if(start>=0)break}
 assert(start>=0,`${name} missing`);
 const brace=html.indexOf('{',start);let depth=0;
 for(let i=brace;i<html.length;i++){
  if(html[i]==='{')depth++;
  else if(html[i]==='}'&&--depth===0)return html.slice(start,i+1);
 }
 throw new Error(`${name} parse failed`);
}

assert(html.includes('id="view-gamedatadeploy"'),'Game data deploy view missing');
assert(html.includes("runLauncherAction('gamedatadeploy')"),'Game data deploy launcher route missing');
assert(html.includes('Gameデータ配置</button>'),'GitHub sync must expose Game data dedicated window');
assert(html.includes('Studio更新配置</button>'),'GitHub sync must keep Studio update as separate window');
assert(html.includes('const GAME_DEPLOY_HISTORY_KEY='),'Game data deployment history must be separate');
assert(html.includes("target='Export/'+normalizeDeployPath(path)"),'Game deployment must be confined to Export/');
assert(html.includes('GitHubファイル削除 0件'),'Game deployment UI must declare zero GitHub file deletion');
assert(html.includes('async function rollbackLastGameDataDeploy()'),'Game data rollback missing');
assert(html.includes('validateGameDeployReferences(artifact)'),'Flag/Quest reference gate missing');

const sandbox={JSON,Object,String,Array,Map,Set};
vm.createContext(sandbox);
for(const name of ['gameDataStableValue','gameDataStableJson','gameDataEnvelopePayload','gameDataRecordId','gameDataRecordLabel','gameDataEntityDiff']){
 vm.runInContext(extractFunction(name),sandbox);
}
function env(data){return JSON.stringify({schema_version:'1.0.0',data_version:'demo',data});}
const remote=env([{id:'Q-1',name:'Old',power:1},{id:'Q-REMOVE',name:'Remove'}]);
const local=env([{id:'Q-1',name:'New',power:2},{id:'Q-ADD',name:'Add'}]);
const diff=sandbox.gameDataEntityDiff('quest/sub_quests.json',local,remote);
assert.equal(diff.supported,true);
assert.deepEqual(Array.from(diff.add,x=>x.id),['Q-ADD']);
assert.deepEqual(Array.from(diff.replace,x=>x.id),['Q-1']);
assert.deepEqual(Array.from(diff.exclude,x=>x.id),['Q-REMOVE']);

for(const name of ['gameDeployParseArtifactData','gameDeployStringList','validateGameDeployReferences'])vm.runInContext(extractFunction(name),sandbox);
const files={
 'event/flags.json':env([{id:'FLAG-OK'}]),
 'event/events.json':env([{id:'EV-1',required_flags:['FLAG-OK'],set_flags:[]}]),
 'quest/main_quests.json':env([{id:'Q-1',required_flags:['FLAG-OK'],set_flags:[],prerequisite_ids:[],next_quest_ids:[]}]),
 'quest/sub_quests.json':env([]),'quest/event_quests.json':env([])
};
assert.equal(sandbox.validateGameDeployReferences({files}).length,0,'valid Flag/Quest references must pass');
files['quest/main_quests.json']=env([{id:'Q-1',required_flags:['FLAG-MISSING'],set_flags:[],prerequisite_ids:[],next_quest_ids:[]}]);
assert(sandbox.validateGameDeployReferences({files}).some(x=>x.code==='GAME_DEPLOY_FLAG_REFERENCE_MISSING'),'missing Flag must block Game deployment');

const deployBody=extractFunction('deployGameDataPlan');
assert(!deployBody.includes("status==='DELETE'"),'Game data deploy must not support GitHub file DELETE');
assert(deployBody.includes('createGitBlob(gameDeployPlan.repo,file)'),'Game deploy must reuse existing Git blob transport');
assert(deployBody.includes('getGitHead(c)'),'Game deploy must reuse existing conflict-safe HEAD check');
console.log('PASS GKS-B582 dedicated Game data GitHub deployment: separate window, entity add/replace/exclude diff, Flag reference gate, zero file delete, conflict-safe commit and rollback');
