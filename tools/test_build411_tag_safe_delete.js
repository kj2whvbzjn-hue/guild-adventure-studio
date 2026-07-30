const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(process.argv[2]||'studio/index.html','utf8');
const match=html.match(/\/\/ BUILD408_TAG_INDEX_SERVICE_BEGIN([\s\S]*?)\/\/ BUILD408_TAG_INDEX_SERVICE_END/);
assert(match,'tag service block not found');
const context={console,Date,Map,Set};vm.createContext(context);vm.runInContext(match[1],context);
const source={tag_categories:[],tags:[
 {id:'FREE',name:'未使用'},
 {id:'LOCKED',name:'固定',locked:true},
 {id:'USED',name:'使用中'},
 {id:'PARENT',name:'親'},
 {id:'CHILD',name:'子',parent_id:'PARENT'},
 {id:'TARGET',name:'置換先'},
 {id:'OLD',name:'旧',deprecated:true,replacement_tag_id:'TARGET'}
],characters:[{id:'C1',name:'人物',tags:['USED']}],masters:{}};
vm.runInContext('serviceForTest=new TagIndexService()',context);
context.serviceForTest.rebuild(source);
assert.strictEqual(context.serviceForTest.canDelete('FREE').allowed,true);
assert.strictEqual(context.serviceForTest.canDelete('LOCKED').allowed,false);
assert.strictEqual(context.serviceForTest.canDelete('USED').allowed,false);
assert.strictEqual(context.serviceForTest.canDelete('PARENT').allowed,false);
assert.deepStrictEqual(Array.from(context.serviceForTest.getReplacementSources('TARGET')),['OLD']);
assert.strictEqual(context.serviceForTest.canDelete('TARGET').allowed,false);
assert(html.includes('function deleteTagSafely(id)'),'safe delete function missing');
assert(html.includes("createBackup('before-tag-physical-delete-'"),'backup guard missing');
assert(html.includes('確認のためタグIDを入力してください'),'typed confirmation missing');
console.log('BUILD411 TagSafeDelete: PASS');
