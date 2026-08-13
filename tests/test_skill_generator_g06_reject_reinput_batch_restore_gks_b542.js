const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('studio/skill/skill-generator.js','utf8');
const document={readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null},dispatchEvent(){}};
const ctx={window:null,document,console,setTimeout,clearTimeout,AbortController,CustomEvent:function(){}};ctx.window=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);
const api=ctx.GKSSkillGenerator;
assert.ok(api.g06ExportBatchResult&&api.g06ImportBatchResult&&api.g06ValidationReportToReinput,'G06 stage3 API missing');

const result={schema:'GKS_SKILL_AI_BATCH_RESULT',version:'1.0.0',aiGenerationRuleVersion:'G05-AI-GENERATION-V1',budgetRuleVersion:'G04-BUDGET-V1',
 entries:[
  {index:0,status:'ACCEPT',request:{skillLevel:10,intent:'ok',effects:[{type:'DAMAGE'}],target:'ENEMY',range:'SINGLE',desiredStrength:'MEDIUM',searchMetadata:{}},skill:{id:'S1'},generation:{},validation:{registry:true,budget:true,compiler:true,issues:[]}},
  {index:1,status:'REJECT',request:{skillLevel:10,intent:'bad',effects:[{type:'NO_SUCH'}],target:'ENEMY',range:'SINGLE',desiredStrength:'MEDIUM',searchMetadata:{}},skill:null,generation:null,validation:{registry:false,budget:false,compiler:false,issues:[{code:'AI_EFFECT_UNKNOWN',path:'effects[0].type',message:'unknown'}]}}
 ],summary:{total:2,accepted:1,rejected:1,allAccepted:false}};
const exported=api.g06ExportBatchResult(result);const restored=api.g06ImportBatchResult(exported);
assert.deepStrictEqual(JSON.parse(JSON.stringify(restored)),result,'Batch Result roundtrip must preserve ACCEPT/REJECT result');

const badSummary=JSON.parse(JSON.stringify(result));badSummary.summary.rejected=0;
assert.throws(()=>api.g06ImportBatchResult(badSummary),e=>e.code==='G06_BATCH_SUMMARY_MISMATCH');
const badField=JSON.parse(JSON.stringify(result));badField.unexpected=true;
assert.throws(()=>api.g06ImportBatchResult(badField),e=>e.code==='G06_UNKNOWN_FIELD');

const report=api.g06ExportValidationReport(result);
assert.strictEqual(report.entries[1].request.intent,'bad','Validation Report must retain source request for correction');
const reinput=api.g06ValidationReportToReinput(report);
assert.strictEqual(reinput.schema,'GKS_SKILL_AI_BATCH_REQUEST');assert.strictEqual(reinput.requests.length,1);assert.strictEqual(reinput.requests[0].intent,'bad');
const noReject=JSON.parse(JSON.stringify(report));noReject.entries=noReject.entries.filter(x=>x.status==='ACCEPT');noReject.summary={total:1,accepted:1,rejected:0,allAccepted:true};
assert.throws(()=>api.g06ValidationReportToReinput(noReject),e=>e.code==='G06_REJECT_REINPUT_EMPTY');
const brokenReport=JSON.parse(JSON.stringify(report));brokenReport.entries[1].request=null;
assert.throws(()=>api.g06ValidationReportToReinput(brokenReport),e=>e.code==='G06_REJECT_REQUEST_MISSING');

for(const marker of ['skgG06BatchExport','skgG06BatchRestore','skgG06ValidationFile','skgG06ValidationToReinput'])assert.ok(src.includes(marker),`missing UI marker ${marker}`);
const html=fs.readFileSync('studio/index.html','utf8');assert.ok(html.includes('skill-generator.js?v=29'));
console.log('PASS GKS-B542 G06 batch restore / validation reject reinput');
