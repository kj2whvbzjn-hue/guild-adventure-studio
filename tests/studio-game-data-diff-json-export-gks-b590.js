const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');

const html=fs.readFileSync(path.resolve(__dirname,'../studio/index.html'),'utf8');
for(const marker of [
  'id="gameDeployDiffExportButton"',
  'onclick="exportGameDeployDiffJson()"',
  'const GAME_DEPLOY_ENTITY_PREVIEW_LIMIT=10;',
  'const GAME_DEPLOY_FILE_PREVIEW_LIMIT=8;',
  "schema:'gk.game-data-deploy-diff.v1'",
  '全件は「差分JSONを出力」で確認できます。',
  '全件は差分JSONに収録しています。'
]) assert(html.includes(marker), marker+' missing');
assert(!html.includes('rows.slice(0,300)'), 'legacy 300-row diff list must be removed');

const start=html.indexOf('function gameDeploySummaries(plan){');
const end=html.indexOf('async function prepareGameDataDeploy(){',start);
assert(start>=0&&end>start,'game deploy diff function block not found');
const block=html.slice(start,end);
const plan={
  owner:'owner',repoName:'repo',branch:'main',headSha:'abc123',artifact:{dataVersion:'demo-0.1.0'},
  entityDiffs:[{path:'event/events.json',add:Array.from({length:12},(_,i)=>({id:`EVT-${String(i+1).padStart(4,'0')}`,label:`E${i+1}`,path:'event/events.json'})),replace:[{id:'EVT-0099',label:'R',path:'event/events.json'}],exclude:[{id:'EVT-0100',label:'X',path:'event/events.json'}],unchanged:[{id:'EVT-0101',label:'U',path:'event/events.json'}]}],
  files:Array.from({length:12},(_,i)=>({target:`Export/f${i}.json`,status:i===0?'ADD':i===1?'MODIFY':'UNCHANGED',size:100+i,sha256:`sha${i}`,gitSha:`git${i}`}))
};
const context={plan};
vm.runInNewContext(block+';this.payload=gameDeployDiffExportPayload(plan);',context);
assert.equal(context.payload.schema,'gk.game-data-deploy-diff.v1');
assert.equal(context.payload.summary.game_data.add,12);
assert.equal(context.payload.summary.game_data.replace,1);
assert.equal(context.payload.summary.game_data.exclude,1);
assert.equal(context.payload.entity_diffs[0].add.length,12,'JSON export must retain all entity rows');
assert.equal(context.payload.file_diffs.length,12,'JSON export must retain all file rows');
assert.equal(context.payload.summary.github_files.delete,0);
console.log('PASS GKS-B591 compact Game deploy diff preview + full JSON export');
