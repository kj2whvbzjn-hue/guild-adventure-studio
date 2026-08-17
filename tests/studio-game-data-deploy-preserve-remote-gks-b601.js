const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('studio/index.html','utf8');
function extractFunction(name){
 const patterns=[`function ${name}(`,`async function ${name}(`];let start=-1;
 for(const p of patterns){start=html.indexOf(p);if(start>=0)break}
 assert(start>=0,`${name} missing`);const brace=html.indexOf('{',start);let depth=0;
 for(let i=brace;i<html.length;i++){if(html[i]==='{')depth++;else if(html[i]==='}'&&--depth===0)return html.slice(start,i+1)}
 throw new Error(`${name} parse failed`);
}
assert(html.includes('id="gameDeployPreserveRemote" type="checkbox" checked'),'preserve mode checkbox must default ON');
assert(html.includes('GitHub版の既存IDを保持（追加・差し替えのみ）'),'preserve mode label missing');
const sandbox={JSON,Object,String,Array,Map,Set};vm.createContext(sandbox);
for(const name of ['gameDataStableValue','gameDataStableJson','gameDataEnvelopePayload','gameDataRecordId','gameDataRecordLabel','gameDataEntityDiff','gameDataEnvelopeWithPayload','gameDataMergePreserveRemote'])vm.runInContext(extractFunction(name),sandbox);
function env(data){return JSON.stringify({schema_version:'1.0.0',data_version:'demo',generated_at:'now',data});}
const remote=env([{id:'OLD-1',name:'keep'},{id:'SAME-1',name:'old'}]);
const local=env([{id:'SAME-1',name:'new'},{id:'NEW-1',name:'add'}]);
const merged=sandbox.gameDataMergePreserveRemote(local,remote);
assert.equal(merged.supported,true);assert.equal(merged.preserved,1);
const payload=sandbox.gameDataEnvelopePayload(merged.text);
assert.deepEqual(Array.from(payload,x=>x.id),['SAME-1','NEW-1','OLD-1']);
assert.equal(payload.find(x=>x.id==='SAME-1').name,'new','local same-ID record must win');
const diff=sandbox.gameDataEntityDiff('x.json',merged.text,remote);
assert.deepEqual(Array.from(diff.add,x=>x.id),['NEW-1']);
assert.deepEqual(Array.from(diff.replace,x=>x.id),['SAME-1']);
assert.deepEqual(Array.from(diff.exclude,x=>x.id),[],'preserve mode must eliminate remote-only exclusion');
const prepare=extractFunction('prepareGameDataDeploy');
assert(prepare.includes('gameDataMergePreserveRemote'),'prepare must merge remote-only records before diff');
assert(prepare.includes('await rebuildGameDeployArtifactManifest(artifact)'),'manifest must be rebuilt after merge');
assert(prepare.indexOf('rebuildGameDeployArtifactManifest')<prepare.indexOf('validateGameDeployReferences(artifact)'),'reference validation must run after preserve merge');
assert(prepare.includes('preserveRemote&&totals.exclude'),'preserve mode must fail closed if exclusions remain');
const manual=fs.readFileSync('docs/operations/GAME_DATA_DEPLOYMENT_MANUAL.md','utf8');
assert(manual.includes('GitHub版の既存IDを保持する安全モード'),'operations manual must document preserve mode');
console.log('PASS GKS-B601 Game data deployment preserve-remote mode keeps GitHub-only IDs, rebuilds manifest, revalidates references, and blocks residual exclusions');
