const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(process.argv[2]||'studio/index.html','utf8');
const match=html.match(/\/\/ BUILD408_TAG_INDEX_SERVICE_BEGIN([\s\S]*?)\/\/ BUILD408_TAG_INDEX_SERVICE_END/);
assert(match,'tag service block not found');
const context={console,Date,Map,Set};vm.createContext(context);vm.runInContext(match[1],context);
const source={tag_categories:[],tags:[
 {id:'OLD',name:'旧',deprecated:true,replacement_tag_id:'MID'},
 {id:'MID',name:'中間',replacement_tag_id:'NEW'},
 {id:'NEW',name:'新'},
 {id:'OFF',name:'無効',enabled:false},
 {id:'DEP',name:'廃止',deprecated:true},
 {id:'A',name:'A',replacement_tag_id:'B'},
 {id:'B',name:'B',replacement_tag_id:'A'}
],characters:[],masters:{}};
vm.runInContext('serviceForTest=new TagIndexService()',context);
context.serviceForTest.rebuild(source);
let chain=context.serviceForTest.resolveReplacementChain('OLD');
assert.deepStrictEqual(Array.from(chain.chain),['OLD','MID','NEW']);
assert.strictEqual(chain.terminal,'NEW');assert.strictEqual(chain.valid,true);
assert.strictEqual(context.serviceForTest.canReplace('OLD','NEW').allowed,true);
assert.strictEqual(context.serviceForTest.canReplace('OLD','OFF').allowed,false);
assert.strictEqual(context.serviceForTest.canReplace('OLD','DEP').allowed,false);
assert.strictEqual(context.serviceForTest.canReplace('A','B').allowed,false);
assert.strictEqual(context.serviceForTest.resolveReplacementChain('A').cycle,true);
console.log('BUILD410 TagLifecycleGuard: PASS');
