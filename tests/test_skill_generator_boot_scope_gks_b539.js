const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const src=fs.readFileSync('studio/skill/skill-generator.js','utf8');

assert(!/compileGenericDraft,\s*buildGenericDraft,\s*getGenericUiDefinition/.test(src),
  'renderPanel-local buildGenericDraft must not be exported from module scope');

const marks=[];
const document={
  readyState:'complete',
  getElementById(){return null;},
  querySelector(){return null;},
  dispatchEvent(){},
  addEventListener(){}
};
const window={
  GKSSkillGeneratorBootDiagnostic:{mark:m=>marks.push(m)},
  document,
  fetch:()=>Promise.reject(new Error('test fetch stop'))
};
const context={
  window, document,
  fetch:window.fetch,
  console,
  setTimeout, clearTimeout,
  AbortController:global.AbortController,
  CustomEvent:function(type,init){this.type=type;this.detail=init&&init.detail;}
};
vm.createContext(context);
vm.runInContext(src,context,{filename:'skill-generator.js'});
assert(marks.some(x=>String(x).startsWith('BOOT-3A:')),
  'module must reach BOOT-3A after top-level initialization');
assert(marks.includes('BOOT-4: boot entered'),
  'ready document must enter boot()');
console.log('PASS GKS-B539 boot scope regression');
