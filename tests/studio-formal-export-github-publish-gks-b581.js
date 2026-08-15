const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Export=require('../studio/export-core.js');
const html=fs.readFileSync('studio/index.html','utf8');
function extractAsyncFunction(name){
 const start=html.indexOf(`async function ${name}(`);assert(start>=0,`${name} missing`);
 const brace=html.indexOf('{',start);let depth=0;
 for(let i=brace;i<html.length;i++){if(html[i]==='{')depth++;else if(html[i]==='}'&&--depth===0)return html.slice(start,i+1)}
 throw new Error(`${name} parse failed`);
}
assert(html.includes('onclick="publishPhpExportToGitHub()"'),'Formal Export GitHub publish button missing');
assert(html.includes('id="phpExportPublishStatus"'),'Formal Export GitHub publish status missing');
assert(html.includes('async function buildPhpExportArtifact()'),'Shared formal Export artifact builder missing');
assert(html.includes('async function publishPhpExportToGitHub()'),'Formal Export GitHub publisher missing');
assert(html.includes("treeEntries.push({path:'Export/'+path,mode:'100644',type:'blob',sha:blob.sha})"),'Publisher must be confined to Export/ paths');
assert(html.includes('削除: 0件'),'Publisher must explicitly declare zero deletion');
assert(Export.EXPORT_PATHS.includes('event/flags.json'),'Formal Export contract must contain flags.json');
const out=Export.buildData({chapters:[],quests:[],events:[],flags:[{id:'FLAG-A',name:'A',default_value:true}],masters:{}});
assert.deepEqual(out['event/flags.json'],[{id:'FLAG-A',name:'A',default_value:true}]);

(async()=>{
 const calls=[],status={innerHTML:''};let busy=false;
 const sandbox={
  ghBusy:false,studioDeployBusy:false,DISTRIBUTION_BUILD:'GKS-B581',
  document:{getElementById:id=>id==='phpExportPublishStatus'?status:null},
  buildPhpExportArtifact:async()=>({dataVersion:'1.2.3',files:{'event/flags.json':'FLAGS','manifest.json':'MANIFEST'}}),
  getGhConfig:()=>({owner:'owner',repo:'repo',branch:'main'}),saveGitHubSettings:()=>{},
  confirm:()=>true,alert:msg=>{throw new Error('unexpected alert: '+msg)},
  setGhBusy:v=>{busy=v},esc:String,utf8ToBase64:text=>Buffer.from(text,'utf8').toString('base64'),
  getGitHead:async()=>({repo:'https://api.github.com/repos/owner/repo',headSha:'HEAD',baseTreeSha:'TREE0'}),
  ghRequest:async(url,opts={})=>{calls.push({url,opts});if(url.endsWith('/git/blobs'))return{sha:'BLOB'+calls.length};if(url.endsWith('/git/trees'))return{sha:'TREE1'};if(url.endsWith('/git/commits'))return{sha:'COMMIT1234567890'};if(url.includes('/git/refs/heads/'))return{};throw new Error('unexpected url '+url)},
  JSON,Buffer,encodeURIComponent,Object,String
 };
 vm.createContext(sandbox);vm.runInContext(extractAsyncFunction('publishPhpExportToGitHub'),sandbox);
 await sandbox.publishPhpExportToGitHub();
 assert.equal(busy,false,'busy state must be released');
 assert.equal(calls.filter(x=>x.url.endsWith('/git/blobs')).length,2,'every formal Export file must become a blob');
 const treeCall=calls.find(x=>x.url.endsWith('/git/trees'));assert(treeCall,'tree commit missing');
 const tree=JSON.parse(treeCall.opts.body).tree;
 assert.deepEqual(tree.map(x=>x.path),['Export/event/flags.json','Export/manifest.json']);
 assert(tree.every(x=>x.mode==='100644'&&x.type==='blob'),'publisher must only write ordinary files');
 assert(!calls.some(x=>x.opts?.method==='DELETE'),'publisher must never delete');
 assert(calls.some(x=>x.url.includes('/git/refs/heads/main')&&x.opts.method==='PATCH'),'branch ref update missing');
 assert(status.innerHTML.includes('正式Export反映完了'),'success status missing');
 console.log('PASS GKS-B581 formal Export GitHub publish: single-commit fixed Export/ writes, zero delete, Flag included');
})().catch(error=>{console.error(error);process.exit(1)});
