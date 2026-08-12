const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('studio/skill/skill-generator.js','utf8');
const document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},dispatchEvent(){}};
const ctx={window:null,document,console,setTimeout,clearTimeout,AbortController,CustomEvent:function(){}};ctx.window=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);
const api=ctx.GKSSkillGenerator;
assert.ok(api.g06ExportAiRequest&&api.g06ExportGenericSkills&&api.g06ExportValidationReport&&api.g06ExportRejectedRequests&&api.g06ImportJsonObject);
const req={schema:'GKS_GENERIC_SKILL_AI_BATCH_REQUEST',version:'1.0.0',requests:[{skillLevel:1}]};
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.g06ImportJsonObject(req,'GKS_GENERIC_SKILL_AI_BATCH_REQUEST'))),req);
assert.throws(()=>api.g06ImportJsonObject({...req,schema:'BAD'},'GKS_GENERIC_SKILL_AI_BATCH_REQUEST'),e=>e.code==='G06_SCHEMA_MISMATCH');
assert.throws(()=>api.g06ImportJsonObject({...req,version:'9'},'GKS_GENERIC_SKILL_AI_BATCH_REQUEST'),e=>e.code==='G06_VERSION_MISMATCH');
const result={schema:'GKS_GENERIC_SKILL_AI_BATCH_RESULT',aiGenerationRuleVersion:'A',budgetRuleVersion:'B',summary:{total:2,accepted:1,rejected:1},entries:[
 {index:0,status:'ACCEPT',request:{intent:'ok'},skill:{schemaVersion:1,id:'S1'},generation:{source:'x'},validation:{registry:true,budget:true,compiler:true,issues:[],budgetResult:{ok:true}}},
 {index:1,status:'REJECT',request:{intent:'bad'},skill:null,validation:{registry:false,budget:false,compiler:false,issues:[{code:'AI_EFFECT_UNKNOWN',path:'effects[0].type'}]}}
]};
const gs=api.g06ExportGenericSkills(result);assert.strictEqual(gs.schema,'GKS_GENERIC_SKILL_BATCH');assert.strictEqual(gs.skills.length,1);assert.strictEqual(gs.skills[0].skill.id,'S1');
const vr=api.g06ExportValidationReport(result);assert.strictEqual(vr.schema,'GKS_GENERIC_SKILL_VALIDATION_REPORT');assert.strictEqual(vr.entries[1].issues[0].code,'AI_EFFECT_UNKNOWN');
const rr=api.g06ExportRejectedRequests(result);assert.strictEqual(rr.schema,'GKS_GENERIC_SKILL_AI_BATCH_REQUEST');assert.strictEqual(rr.requests.length,1);assert.strictEqual(rr.requests[0].intent,'bad');
assert.throws(()=>api.g06ExportRejectedRequests({...result,entries:[result.entries[0]]}),e=>e.code==='G06_REJECT_REINPUT_EMPTY');
const html=fs.readFileSync('studio/skill/skill-generator.js','utf8');for(const m of ['skgG06AiExport','skgG06GenericExport','skgG06ValidationExport','skgG06RejectExport'])assert.ok(html.includes(m));
console.log('PASS GKS-B540 G06 JSON IO stage1');
