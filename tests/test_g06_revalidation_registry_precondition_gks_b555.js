'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..');
const studio=fs.readFileSync(path.join(root,'studio/skill/skill-generator.js'),'utf8');
for(const token of [
  'g06-roundtrip',
  'G06 Batch Result再Import',
  'Validation Report → REJECT再入力',
  'G06 Skill JSON再Import検証',
  '旧一括JSON互換',
  'g06RevalidateSkillBatch',
  'g06ValidationReportToReinput',
  'g06ImportBatchResult',
  'g06ExportBatchResult',
  'G06_REJECT_Reinput.json',
  'G06_Validation_Report.json',
  'G06_Batch_Result.json'
]) assert(!studio.includes(token),`legacy G06 token remains: ${token}`);
assert(studio.includes('Formal Skill一括生成'));
assert(studio.includes('buildFormalSkillBatch'));
assert(studio.includes('G07登録Dry Run'));
console.log('PASS formal Studio G06 round-trip legacy removed');
