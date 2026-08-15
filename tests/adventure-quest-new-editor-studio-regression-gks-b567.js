'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const studio=fs.readFileSync('studio/index.html','utf8');

assert(studio.includes('onclick="openQuestEditor()">＋新規</button>'),'Quest new button must call openQuestEditor');
assert(studio.includes("function openQuestEditor(){clearQuestForm();openStudioInputPanel('questEditorPanel','クエストを作成');renderQuestFormalStatus()}"),'Quest new editor open path changed unexpectedly');

const start=studio.indexOf('function renderQuestFormalWorkflow(){');
const end=studio.indexOf('function refreshQuestMapOptions',start);
assert(start>=0&&end>start,'renderQuestFormalWorkflow block not found');
const block=studio.slice(start,end);
assert(!/\bp6Ready\b/.test(block),'Quest workflow must not reference undefined p6Ready');
assert(!/\.p6_runtime\b/.test(block),'Quest workflow must use the current p7_runtime assessment');
assert(/\bp7Ready\b/.test(block),'Quest workflow must use p7Ready');
assert(/\.p7_runtime\?\.issues/.test(block),'Quest workflow must read current P7 runtime issues');

const el={innerHTML:''};
const sandbox={
  document:{getElementById(id){return id==='questFormalWorkflow'?el:null}},
  formalQuestWorkflowState(){return {questBoxes:[],assessment:{ready:false,p7_runtime_ready:false,p7_runtime:{issues:[{message:'runtime test'}]}}}},
  esc(value){return String(value??'')},
};
vm.createContext(sandbox);
vm.runInContext(`${block}; renderQuestFormalWorkflow();`,sandbox,{filename:'quest-formal-workflow-regression.js'});
assert(el.innerHTML.includes('P7-B Game Runtime'),'Quest formal workflow must render without ReferenceError');
assert(el.innerHTML.includes('runtime test'),'P7 runtime issue details must render');
console.log('adventure-quest-new-editor-studio-regression-gks-b569 PASS');
