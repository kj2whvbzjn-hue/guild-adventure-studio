const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(process.argv[2]||'studio/index.html','utf8');
const match=html.match(/\/\/ BUILD408_TAG_INDEX_SERVICE_BEGIN([\s\S]*?)\/\/ BUILD408_TAG_INDEX_SERVICE_END/);
assert(match,'BUILD408 service block not found');
const context={console,Date,Map,Set};vm.createContext(context);vm.runInContext(match[1],context);
const source={
 tag_categories:[{id:'CAT',name:'分類'}],
 tags:[{id:'FIRE',name:'炎',category_id:'CAT',aliases:['火']},{id:'BURN',name:'燃焼',parent_id:'FIRE'}],
 characters:[{id:'CHR-1',name:'勇者',tags:['FIRE']}],
 masters:{skills:[{id:'SKL-1',name:'火球',tags:['FIRE','BURN']}],equipment:[]}
};
vm.runInContext('serviceForTest=new TagIndexService()',context);
context.serviceForTest.rebuild(source);
assert.strictEqual(context.serviceForTest.getUsage('FIRE'),2);
assert.strictEqual(context.serviceForTest.getUsage('BURN'),1);
assert.deepStrictEqual(Array.from(context.serviceForTest.getChildren('FIRE')),['BURN']);
assert.deepStrictEqual(Array.from(context.serviceForTest.resolve('火')),['FIRE']);
assert.strictEqual(context.serviceForTest.getReferences('FIRE').length,2);
assert.strictEqual(context.serviceForTest.canDelete('FIRE').allowed,false);
assert.strictEqual(context.serviceForTest.canDelete('UNKNOWN').allowed,false);
assert.strictEqual(context.serviceForTest.snapshot().references,3);
console.log('BUILD408 TagIndexService: PASS');
