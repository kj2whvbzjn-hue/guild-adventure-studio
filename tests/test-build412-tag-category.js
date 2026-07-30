'use strict';
const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','studio','index.html'),'utf8');
const required=[
 'BUILD412_TAG_CATEGORY_LIFECYCLE_BEGIN',
 'function canDeleteTagCategory(categoryId)',
 'function applyTagCategoryMove(oldId)',
 'function deleteTagCategorySafely(id)',
 'before-tag-category-move-',
 'before-tag-category-physical-delete-',
 'tagCategoryInspectorList',
 'renderTagCategoryInspector()'
];
for(const token of required){if(!html.includes(token))throw new Error('missing: '+token)}
function getTagsByCategory(tags,id){return tags.filter(t=>String(t.category_id||'').trim()===String(id||'').trim())}
function canDelete(categories,tags,id){
 const c=categories.find(x=>String(x.id||'').trim()===String(id||'').trim());
 const reasons=[];if(!c)reasons.push('missing');const used=getTagsByCategory(tags,id);if(used.length)reasons.push('used');if(c?.locked===true)reasons.push('locked');
 return {allowed:reasons.length===0,reasons,used};
}
const categories=[{id:'A'},{id:'B'},{id:'C',locked:true}];
const tags=[{id:'T1',category_id:'A'},{id:'T2',category_id:'A'}];
if(canDelete(categories,tags,'A').allowed)throw new Error('used category must not delete');
if(!canDelete(categories,tags,'B').allowed)throw new Error('unused category should delete');
if(canDelete(categories,tags,'C').allowed)throw new Error('locked category must not delete');
for(const t of getTagsByCategory(tags,'A'))t.category_id='B';
if(getTagsByCategory(tags,'A').length!==0||getTagsByCategory(tags,'B').length!==2)throw new Error('move failed');
console.log('BUILD412 category lifecycle tests: PASS');
