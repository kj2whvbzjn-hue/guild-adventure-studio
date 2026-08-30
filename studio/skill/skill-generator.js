(function(global){
'use strict';
const bootDiag=message=>{try{global.GKSSkillGeneratorBootDiagnostic?.mark?.(message);}catch{}};
bootDiag('BOOT-3: module entered');
const VERSION='1.9.0';
let skillRegistry=null,skillUiDefinition=null,budgetRules=null,aiGenerationRules=null,aiBatchPreview=null,lastFormalSkillBatch=null;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const stamp=()=>new Date().toISOString();
const hostData=()=>global.GKSSkillHost?.getData?.()||global.data;
const skillAuthoringRegistryApi=()=>global.GKSSkillAuthoringRegistry;
const skillBudgetEngineApi=()=>global.GKSSkillBudgetEngine;
const skillAiBatchEngineApi=()=>global.GKSSkillAiBatchEngine;
const skillCompileServiceApi=()=>global.GKSSkillCompileService?.compileSkill?global.GKSSkillCompileService:null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEPENDENCY_TIMEOUT_MS=12000;
async function fetchJsonDependency(url,label,{timeoutMs=DEPENDENCY_TIMEOUT_MS}={}){
 bootDiag(`DEP-START: ${label}`);
 const controller=typeof AbortController==='function'?new AbortController():null;let timer=null;
 try{
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{try{controller?.abort();}catch{}reject(new Error(`${label} の読込が ${Math.ceil(timeoutMs/1000)}秒でタイムアウトしました`));},timeoutMs);});
  const request=fetch(url,{cache:'no-store',...(controller?{signal:controller.signal}:{})});
  const r=await Promise.race([request,timeout]);
  if(!r?.ok)throw new Error(`${label} の読込に失敗しました${r?.status?` (HTTP ${r.status})`:''}`);
  const json=await r.json(); bootDiag(`DEP-OK: ${label}`); return json;
 }catch(error){
  bootDiag(`DEP-FAIL: ${label}: ${error?.message||error}`);
  if(error?.name==='AbortError')throw new Error(`${label} の読込がタイムアウトしました`);
  throw error;
 }finally{if(timer)clearTimeout(timer);}
}
async function loadSkillDefinition({force=false}={}){if(force||!skillRegistry)skillRegistry=await fetchJsonDependency('../assets/shared/config/skill-registry.json','Skill Registry');if(!skillAuthoringRegistryApi()?.buildUiDefinition)throw new Error('Skill Authoring Registryが読み込まれていません');skillUiDefinition=skillAuthoringRegistryApi().buildUiDefinition(skillRegistry);return clone(skillUiDefinition);}
function skillEffectRequirements(type,draft={}){if(!skillRegistry)throw new Error('Skill Registryを先に読み込んでください');return skillAuthoringRegistryApi().resolveEffectRequirements(skillRegistry,type,draft);}
function skillConditionRequirements(property){if(!skillRegistry)throw new Error('Skill Registryを先に読み込んでください');return skillAuthoringRegistryApi().resolveConditionRequirements(skillRegistry,property);}
async function loadBudgetRules({force=false}={}){if(force||!budgetRules)budgetRules=await fetchJsonDependency('../assets/shared/config/skill-budget-rules.json','Budget Rules');if(!skillBudgetEngineApi()?.calculate)throw new Error('Skill Budget Engineが読み込まれていません');return clone(budgetRules);}
function calculateSkillBudget(draft,options={}){if(!budgetRules)throw new Error('Skill Budget Rulesを先に読み込んでください');return skillBudgetEngineApi().calculate(draft,budgetRules,skillRegistry,options);}
async function loadAiGenerationRules({force=false}={}){if(force||!aiGenerationRules)aiGenerationRules=await fetchJsonDependency('../assets/shared/config/skill-ai-generation-rules.json','AI Rules');return clone(aiGenerationRules);}
function aiRequestTemplate(){return{schema:'GKS_SKILL_AI_BATCH_REQUEST',version:'1.0.0',requests:[{skillLevel:10,intent:'敵ランダム2体への物理攻撃',effects:[{type:'DAMAGE',damageType:'PHYSICAL'}],target:'ENEMY',range:'RANDOM',randomCount:2,trigger:{type:'ON_USE',scope:'SELF'},conditions:[],resource:{mpCost:8,cooldown:100,activationPriority:0,castTime:20},desiredStrength:'MEDIUM',searchMetadata:{tags:['攻撃','ランダム'],description:'AIはIntent/Structure/正式Resource calibrationを指定し、Effect完成戦闘数値はStudioが決定する。'}},{skillLevel:10,intent:'味方単体を回復',effects:[{type:'HEAL'}],target:'ALLY',range:'SINGLE',trigger:{type:'ON_USE',scope:'SELF'},conditions:[],resource:{mpCost:5,cooldown:0,activationPriority:0,castTime:0},desiredStrength:0.65,searchMetadata:{tags:['回復']}}]};}
async function generateSkillAiBatch(payload){if(!skillAiBatchEngineApi()?.generateBatch)throw new Error('G05 AI Batch Engineが読み込まれていません');if(!aiGenerationRules)await loadAiGenerationRules();aiBatchPreview=await skillAiBatchEngineApi().generateBatch(payload,{registry:skillRegistry,budgetRules,rules:aiGenerationRules,idPrefix:'G05-AI',validateFinal:false});lastFormalSkillBatch=buildFormalSkillBatch(aiBatchPreview);return clone(aiBatchPreview);}
const SKILL_BATCH_VERSION='1.0.0';
function exportAiRequest(payload){const src=payload==null?aiRequestTemplate():clone(payload);if(src?.schema!=='GKS_SKILL_AI_BATCH_REQUEST'||src?.version!=='1.0.0'||!Array.isArray(src?.requests))throw Object.assign(new Error('AI Request JSON形式が不正です'),{code:'AI_REQUEST_SCHEMA_INVALID'});return clone(src);}
function buildFormalSkillBatch(result=aiBatchPreview){const entries=Array.isArray(result?.entries)?result.entries:[],accepted=entries.filter(x=>x?.status==='ACCEPT'&&x?.skill).map(x=>({index:x.index,skill:clone(x.skill),generation:clone(x.generation||{}),validation:{budgetResult:clone(x.validation?.budgetResult||null),compilerWarnings:clone(x.validation?.compilerWarnings||[])}}));if(!accepted.length)throw Object.assign(new Error('Formal Batch対象のACCEPT Skillがありません'),{code:'FORMAL_SKILL_BATCH_EMPTY'});return{schema:'GKS_SKILL_BATCH',version:SKILL_BATCH_VERSION,sourceSchema:result?.schema||'GKS_SKILL_AI_BATCH_RESULT',aiGenerationRuleVersion:result?.aiGenerationRuleVersion||'',budgetRuleVersion:result?.budgetRuleVersion||'',skills:accepted};}
function assertJsonObjectSchema(payload,expectedSchema){if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Object.assign(new Error('JSON objectが必要です'),{code:'JSON_OBJECT_REQUIRED'});if(payload.schema!==expectedSchema)throw Object.assign(new Error(`schema不一致: ${payload.schema||'(なし)'} / expected ${expectedSchema}`),{code:'SCHEMA_MISMATCH'});if(payload.version!==SKILL_BATCH_VERSION&&!(expectedSchema==='GKS_SKILL_AI_BATCH_REQUEST'&&payload.version==='1.0.0'))throw Object.assign(new Error(`version不一致: ${payload.version||'(なし)'}`),{code:'VERSION_MISMATCH'});return clone(payload);}
function collectUnknownFields(obj,allowed,path){if(!obj||typeof obj!=='object'||Array.isArray(obj))return[];return Object.keys(obj).filter(k=>!allowed.includes(k)).map(k=>({code:'JSON_UNKNOWN_FIELD',path:path?`${path}.${k}`:k,message:`未知field: ${path?`${path}.`:''}${k}`}));}


const present=v=>!(v===undefined||v===null||String(v).trim()==='');

function g07AuditStorageKey(){return `gks_data_exchange_audit_v1_${String(hostData()?.project?.id||'default')}`;}
function g07DryRunBlocker(dry){
 const summary=dry?.summary||{},items=Array.isArray(dry?.items)?dry.items:[];
 const checks=[
  ['stale_source','G07_STALE_SOURCE','stale source','同一IDの現在Masterと登録候補の内容が一致しません。古い/別内容のデータとして扱い、上書きを停止しました。','既存Masterを残すなら登録候補のIDを変更してください。既存Masterを更新する意図なら、差分を確認して専用の更新経路を使用してください。'],
  ['broken_reference','G07_BROKEN_REFERENCE','broken reference','登録候補が参照するIDを現在Projectまたは同時Import内で解決できません。','不足している参照先を先に登録するか、参照IDを修正してください。'],
  ['conflict','G07_ID_CONFLICT','既存ID競合','同一IDのMasterがすでに存在し、内容が異なります。自動上書きを停止しました。','新規登録ならIDを変更してください。更新目的なら差分確認後に明示的な更新経路を使用してください。'],
  ['invalid','G07_INVALID_IMPORT','invalid','Data Exchange検査で登録候補が無効と判定されました。','表示された対象とdetailを確認し、入力データを修正してください。'],
  ['incompatible','G07_INCOMPATIBLE_IMPORT','incompatible','現在のProject/Data Exchange仕様と互換性がありません。','schema/version/対象datasetの互換性を確認してください。'],
  ['readonly_modified','G07_READONLY_MODIFIED','read-only変更','read-only参照データの追加または変更が検出されました。','read-only対象は変更せず、正本側のデータを確認してください。']
 ];
 for(const [field,code,label,explanation,recommendation] of checks){
  const count=Number(summary[field]||0);
  if(count>0){
   const affected=items.filter(x=>x?.status===field).map(x=>({dataset:String(x.dataset||''),id:String(x.id||''),detail:String(x.detail||'')}));
   return{code,count,label,explanation,recommendation,affected,message:`G07登録拒否: ${label} ${count}件`};
  }
 }
 return null;
}
function g07FormatBlocker(blocker){
 if(!blocker)return'';
 const rows=(blocker.affected||[]).slice(0,8).map(x=>`・${x.dataset||'(dataset不明)'} / ${x.id||'(ID不明)'}${x.detail?` — ${x.detail}`:''}`);
 const more=(blocker.affected||[]).length>8?`<br>…ほか ${(blocker.affected||[]).length-8}件`:'';
 return `<b>G07 Dry Run REJECT [${esc(blocker.code)}]</b><br><b>原因:</b> ${esc(blocker.label)} ${blocker.count}件<br><b>安全処理:</b> ${esc(blocker.explanation)}<br>${rows.length?`<b>対象:</b><br>${rows.map(esc).join('<br>')}${more}<br>`:''}<b>推奨対応:</b> ${esc(blocker.recommendation)}`;
}
async function g07AssertFormalMasterContract(){
 const dx=global.GKSDataExchange;
 if(!dx?.FORMAL_SKILL_MASTER_FIELDS||!dx?.skillMasterContractDiagnostic)throw Object.assign(new Error('G07正式Skill Master契約が読み込まれていません'),{code:'G07_FORMAL_MASTER_CONTRACT_REQUIRED'});
 const required=['schemaVersion','id','name','skillLevel','trigger','conditions','target','effects','resource','runtimeContracts'];
 const missing=required.filter(x=>!dx.FORMAL_SKILL_MASTER_FIELDS.includes(x));
 if(missing.length)throw Object.assign(new Error(`G07正式Skill Master契約が不足しています: ${missing.join(', ')}`),{code:'G07_FORMAL_MASTER_CONTRACT_INCOMPLETE',missing});
 const diagnostic=dx.skillMasterContractDiagnostic();
 if(!diagnostic.shared_matches){
  console.warn('[G07] shared Skill Schema cache/version mismatch; Data Exchange canonical contract is authoritative.',diagnostic);
 }
 return{required:[...required],diagnostic:clone(diagnostic)};
}


function stableJson(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(stableJson).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableJson(value[k])).join(',')+'}';}
async function g07ValidateFormalSkillRuntime(skill){
 if(!skillRegistry)await loadSkillDefinition();
 if(!budgetRules)await loadBudgetRules();
 if(!skill||typeof skill!=='object'||Array.isArray(skill))throw Object.assign(new Error('正式Skill objectが必要です'),{code:'G07_SKILL_OBJECT_REQUIRED'});
 for(const key of g07FormalSkillUnknownFields(skill))throw Object.assign(new Error(`正式Skill Masterの未知フィールドです: ${key}`),{code:'G07_UNKNOWN_SKILL_FIELD',path:key});
 const tagIds=new Set((hostData()?.tags||[]).filter(t=>t?.enabled!==false&&t?.deprecated!==true).map(t=>String(t?.id||'')));for(const [i,r] of (Array.isArray(skill.useRequirements)?skill.useRequirements:[]).entries())for(const key of ['allTags','anyTags'])for(const tag of (Array.isArray(r?.[key])?r[key]:[]))if(!tagIds.has(String(tag)))throw Object.assign(new Error(`useRequirementsが未登録Tagを参照しています: ${tag}`),{code:'G07_USE_REQUIREMENT_TAG_UNKNOWN',path:`useRequirements[${i}].${key}`,tag_id:String(tag)});
 const budget=calculateSkillBudget(skill);
 if(!budget?.ok)throw Object.assign(new Error((budget?.errors||[]).join(' / ')||'Skill Budget REJECT'),{code:(budget?.errors||[]).some(x=>String(x).startsWith('SKILL_BUDGET_EXCEEDED'))?'SKILL_BUDGET_EXCEEDED':'G07_BUDGET_REJECT',budget:clone(budget)});
 const compiled=await compileSkillDraft(skill);
 if(!compiled?.ok)throw Object.assign(new Error((compiled?.errors||[]).map(x=>x.message||String(x)).join(' / ')||'Formal Skill compile REJECT'),{code:'G07_FORMAL_COMPILE_REJECT',errors:clone(compiled?.errors||[])});
 if(!compiled?.compiledSkill?.runtimeContracts)throw Object.assign(new Error('正式CompilerがruntimeContractsを生成しませんでした'),{code:'G07_RUNTIME_CONTRACTS_REQUIRED'});
 if(!skill.runtimeContracts)throw Object.assign(new Error('Formal Battle SkillにはG07生成済みruntimeContractsが必要です'),{code:'G07_RUNTIME_CONTRACTS_REQUIRED'});
 if(stableJson(skill.runtimeContracts)!==stableJson(compiled.compiledSkill.runtimeContracts))throw Object.assign(new Error('入力runtimeContractsが正式Compiler再生成結果と一致しません'),{code:'G07_RUNTIME_CONTRACTS_MISMATCH'});
 return{skill:clone(compiled.compiledSkill),budget:clone(budget),warnings:clone(compiled.warnings||[])};
}
function g07NormalizeSkillBatch(payload){
 const batch=clone(payload);
 if(!batch||typeof batch!=='object'||Array.isArray(batch))throw Object.assign(new Error('G07 Skill Batch JSONがオブジェクトではありません'),{code:'G07_SKILL_BATCH_INVALID'});
 const acceptedSchemas=new Set(['GKS_SKILL_BATCH']);
 if(!acceptedSchemas.has(batch.schema))throw Object.assign(new Error(`G07 Skill Batch schemaが不正です: ${batch.schema||'(なし)'}`),{code:'G07_SKILL_BATCH_SCHEMA_INVALID'});
 if(batch.version!=='1.0.0')throw Object.assign(new Error(`G07 Skill Batch versionが不正です: ${batch.version||'(なし)'}`),{code:'G07_SKILL_BATCH_VERSION_INVALID'});
 batch.schema='GKS_SKILL_BATCH';
 return batch;
}
function g07FormalSkillUnknownFields(skill){
 const schema=global.GKSSkillSchema;
 const masterAllowed=new Set(global.GKSDataExchange?.FORMAL_SKILL_MASTER_FIELDS||schema?.masterAllowed?.()||[]);
 return Object.keys(skill||{}).filter(key=>!masterAllowed.has(key));
}
const G07_FORMAL_SKILL_ID_RE=/^SKL-\d{4}$/;
function g07AllocateFormalSkillIds(count){
 const used=new Set((hostData()?.masters?.skills||[]).map(x=>String(x?.id||'')).filter(id=>G07_FORMAL_SKILL_ID_RE.test(id)));
 const ids=[];
 for(let n=1;n<=9999&&ids.length<count;n++){
  const id=`SKL-${String(n).padStart(4,'0')}`;
  if(!used.has(id)){used.add(id);ids.push(id);}
 }
 if(ids.length!==count)throw Object.assign(new Error(`正式Skill ID採番枠が不足しています: required=${count} available=${ids.length}`),{code:'G07_FORMAL_ID_EXHAUSTED'});
 return ids;
}
async function g07RevalidateSkillBatch(payload){
 if(!skillRegistry)await loadSkillDefinition();
 if(!budgetRules)await loadBudgetRules();
 const batch=g07NormalizeSkillBatch(payload);
 const rootAllowed=global.GKSSkillSchema?.BATCH?.root||['schema','version','sourceSchema','aiGenerationRuleVersion','budgetRuleVersion','skills'];
 const rowAllowed=global.GKSSkillSchema?.BATCH?.row||['index','skill','generation','validation'];
 const rootIssues=collectUnknownFields(batch,rootAllowed,'$');
 if(!Array.isArray(batch.skills)||!batch.skills.length)rootIssues.push({code:'G07_SKILLS_REQUIRED',path:'skills',message:'skillsを1件以上指定してください'});
 const entries=[],compiledSkills=[];
 for(let i=0;i<(Array.isArray(batch.skills)?batch.skills:[]).length;i++){
  const row=batch.skills[i],issues=[...collectUnknownFields(row,rowAllowed,`skills[${i}]`)];
  const skill=row?.skill;
  if(!skill||typeof skill!=='object'||Array.isArray(skill)){
   issues.push({code:'G07_SKILL_OBJECT_REQUIRED',path:`skills[${i}].skill`,message:'正式Skill objectが必要です'});
  }else{
   for(const key of g07FormalSkillUnknownFields(skill))issues.push({code:'G07_UNKNOWN_SKILL_FIELD',path:`skills[${i}].skill.${key}`,message:`正式Skill Masterの未知フィールドです: ${key}`});
  }
  let budget=null,compiled=null;
  if(!issues.length){
   try{
    budget=calculateSkillBudget(skill);
    if(!budget?.ok)for(const message of budget?.errors||[])issues.push({code:String(message).startsWith('SKILL_BUDGET_EXCEEDED')?'SKILL_BUDGET_EXCEEDED':'G07_BUDGET_REJECT',path:`skills[${i}].skill`,message});
    if(!issues.length)compiled=await compileSkillDraft(skill);
    if(!issues.length&&!compiled?.ok){
     for(const e of compiled?.errors||[])issues.push({code:e.code||'G07_FORMAL_COMPILE_REJECT',path:`skills[${i}].skill.${e.path||''}`,message:e.message||String(e)});
    }else if(!issues.length&&!compiled?.compiledSkill?.runtimeContracts){
     issues.push({code:'G07_RUNTIME_CONTRACTS_REQUIRED',path:`skills[${i}].skill.runtimeContracts`,message:'正式CompilerがruntimeContractsを生成しませんでした'});
    }else if(!issues.length&&skill.runtimeContracts&&stableJson(skill.runtimeContracts)!==stableJson(compiled.compiledSkill.runtimeContracts)){
     issues.push({code:'G07_RUNTIME_CONTRACTS_MISMATCH',path:`skills[${i}].skill.runtimeContracts`,message:'入力runtimeContractsが正式Compiler再生成結果と一致しません'});
    }
   }catch(e){
    issues.push({code:e.code||'G07_FORMAL_REVALIDATION_FAILED',path:`skills[${i}].skill`,message:e.message||String(e)});
   }
  }
  const accepted=issues.length===0;
  if(accepted)compiledSkills.push(clone(compiled.compiledSkill));
  entries.push({index:i,skillId:skill?.id||null,masterSkillId:null,status:accepted?'ACCEPT':'REJECT',budgetResult:clone(budget),compilerWarnings:clone(compiled?.warnings||[]),issues});
 }
 if(rootIssues.length===0&&compiledSkills.length){
  const formalIds=g07AllocateFormalSkillIds(compiledSkills.length);
  let acceptedIndex=0;
  for(const entry of entries){
   if(entry.status!=='ACCEPT')continue;
   const formalId=formalIds[acceptedIndex];
   compiledSkills[acceptedIndex].id=formalId;
   entry.masterSkillId=formalId;
   acceptedIndex++;
  }
 }
 return{
  schema:'GKS_SKILL_REVALIDATION_REPORT',version:'1.0.0',sourceSchema:batch.schema,
  summary:{total:entries.length,accepted:entries.filter(x=>x.status==='ACCEPT').length,rejected:entries.filter(x=>x.status==='REJECT').length,rootIssueCount:rootIssues.length,allAccepted:rootIssues.length===0&&entries.length>0&&entries.every(x=>x.status==='ACCEPT'),canRegisterAccepted:rootIssues.length===0&&compiledSkills.length>0},
  rootIssues,entries,compiledSkills,batch
 };
}

async function g07BuildMasterEnvelopeFromSkillBatch(payload){
 const masterContract=g07AssertFormalMasterContract();
 const report=await g07RevalidateSkillBatch(payload);
 if(report.summary.rootIssueCount>0)throw Object.assign(new Error(`G07登録拒否: Batch root issues ${report.summary.rootIssueCount}`),{code:'G07_REVALIDATION_ROOT_REJECT',report});
 const batch=report.batch,rows=report.compiledSkills.map(clone);

 if(!rows.length)throw Object.assign(new Error(`G07登録対象Skillがありません: REJECT ${report.summary.rejected}`),{code:'G07_REGISTER_EMPTY',report});
 const ids=rows.map(x=>String(x.id||''));
 if(ids.some(x=>!G07_FORMAL_SKILL_ID_RE.test(x)))throw Object.assign(new Error('G07登録対象Skill IDが正式形式 SKL-0000 に準拠していません'),{code:'G07_FORMAL_ID_INVALID'});
 if(new Set(ids).size!==ids.length)throw Object.assign(new Error('G07登録対象内でID重複があります'),{code:'G07_DUPLICATE_ID_IN_BATCH'});
 if(!global.GKSDataExchange?.buildEnvelope)throw Object.assign(new Error('Data Exchange基盤がありません'),{code:'G07_DATA_EXCHANGE_REQUIRED'});
 const root=clone(hostData()||{});root.project=root.project||{id:'PROJECT'};root.masters=root.masters||{};root.masters.skills=rows;
 const envelope=await global.GKSDataExchange.buildEnvelope({rootData:root,dataset:'skills',ids,dependencyMode:'direct',studioVersion:String(global.GKSSkillHost?.getBuild?.()||global.DISTRIBUTION_BUILD||'')});
 return{envelope:clone(envelope),revalidation:report,masterSkills:rows,masterContract};
}
async function g07DryRunMasterRegistration(payload){
 const built=await g07BuildMasterEnvelopeFromSkillBatch(payload),source=clone(hostData()||{});
 const sourceHash=global.GKSDataExchangeTransaction?.projectHash?await global.GKSDataExchangeTransaction.projectHash(source):null;
 const dry=await global.GKSDataExchange.dryRunImport({rootData:source,envelope:built.envelope});
 if(!dry?.ok)throw Object.assign(new Error('G07 Dry Runが停止しました'),{code:'G07_DRY_RUN_REJECT',dryRun:dry});
 const blocker=g07DryRunBlocker(dry);if(blocker)throw Object.assign(new Error(blocker.message),{code:blocker.code,dryRun:dry,count:blocker.count,g07Blocker:blocker});
 if((dry.summary?.add||0)!==built.masterSkills.length)throw Object.assign(new Error(`G07登録拒否: add件数不一致 expected=${built.masterSkills.length} actual=${dry.summary?.add||0}`),{code:'G07_ADD_COUNT_MISMATCH',dryRun:dry});
 const plan=await global.GKSDataExchange.createApplyPlan({rootData:source,envelope:built.envelope,dryRun:dry,conflictChoices:{}});
 if(!plan?.can_apply)throw Object.assign(new Error((plan?.reasons||['G07 Apply Plan拒否']).join(' / ')),{code:'G07_APPLY_PLAN_REJECT',plan,dryRun:dry});
 return{...built,dryRun:clone(dry),plan:clone(plan),sourceHash,beforeData:source};
}
async function g07SafeApplySkillBatch(payload){
 const checked=await g07DryRunMasterRegistration(payload);
 if(!global.GKSDataExchangeTransaction?.projectHash)throw Object.assign(new Error('Transaction hash基盤がありません'),{code:'G07_TRANSACTION_HASH_REQUIRED'});
 const currentBefore=clone(hostData()||{}),currentHash=await global.GKSDataExchangeTransaction.projectHash(currentBefore);
 if(checked.sourceHash&&currentHash!==checked.sourceHash)throw Object.assign(new Error('G07登録拒否: Dry Run後にMaster sourceが変更されました'),{code:'G07_STALE_SOURCE_HASH',expected:checked.sourceHash,actual:currentHash});
 const plan=await global.GKSDataExchange.createApplyPlan({rootData:currentBefore,envelope:checked.envelope,dryRun:checked.dryRun,conflictChoices:{}});
 if(!plan?.can_apply)throw Object.assign(new Error((plan?.reasons||['G07 Apply Plan拒否']).join(' / ')),{code:'G07_APPLY_PLAN_REJECT',plan});
 if(!global.GKSDataExchangeTransaction?.execute)throw Object.assign(new Error('Transaction基盤がありません'),{code:'G07_TRANSACTION_REQUIRED'});
 if(!global.GKSDataExchangeAudit)throw Object.assign(new Error('Audit基盤がありません'),{code:'G07_AUDIT_REQUIRED'});
 let tx=null,auditSession=null;
 try{
  tx=await global.GKSDataExchangeTransaction.execute({
   rootData:currentBefore,envelope:checked.envelope,plan,dryRun:checked.dryRun,
   backup:()=>global.GKSSkillHost?.backup?.('before-g07-formal-skill-safe-apply')!==false,
   commit:c=>global.GKSSkillHost?.setData?.(c)!==false,
   persist:()=>global.GKSSkillHost?.persist?.(`G07 Formal Skill Safe Apply: add=${plan.add_count}`)!==false,
   rollback:o=>global.GKSSkillHost?.setData?.(o)!==false
  });
  const afterData=clone(hostData()||{}),afterHash=await global.GKSDataExchangeTransaction.projectHash(afterData);
  const beforeDatasetHash=await global.GKSDataExchangeAudit.datasetHash(currentBefore,'skills');
  const afterDatasetHash=await global.GKSDataExchangeAudit.datasetHash(afterData,'skills');
  auditSession=global.GKSDataExchangeAudit.buildSession({
   transaction:tx,plan,envelope:checked.envelope,beforeData:currentBefore,afterHash,beforeDatasetHash,afterDatasetHash,
   sourceFilename:'G07_SKILL_GENERATOR_FORMAL_BATCH.json',projectId:String(currentBefore?.project?.id||'')
  });
  if(typeof localStorage==='undefined'||!global.GKSDataExchangeAudit.append(localStorage,g07AuditStorageKey(),auditSession)){
   throw Object.assign(new Error('G07 Audit記録を保存できませんでした'),{code:'G07_AUDIT_SAVE_FAILED'});
  }
 }catch(e){
  if(tx?.ok){
   try{global.GKSSkillHost?.setData?.(clone(currentBefore));global.GKSSkillHost?.persist?.('G07 Audit failure rollback');}catch{}
  }
  throw e;
 }
 return{...checked,plan:clone(plan),transaction:clone(tx),auditSession:clone(auditSession)};
}
function download(name,obj){const text=JSON.stringify(obj,null,2);if(typeof global.downloadText==='function')return global.downloadText(name,text,'application/json;charset=utf-8');const b=new Blob([text],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function renderPanel(){
 const workspace=document.querySelector('main.workspace');if(!workspace)return;
 let s=document.getElementById('view-skill-generator');const shellVisible=!!s&&!s.classList.contains('hidden');if(s&&s.dataset.skgShell!=='loading')return;
 const style=document.createElement('style');style.textContent=`
 #view-skill-generator .skg-step{border-left:4px solid var(--accent,#3b82f6)}
 #view-skill-generator .skg-runtime-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%;max-width:100%}
 #view-skill-generator .skg-runtime-grid label{display:flex;gap:8px;align-items:center;justify-content:flex-start;min-width:0;width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line,#ddd);border-radius:10px;overflow:hidden}
 #view-skill-generator .skg-runtime-grid input[type=checkbox]{appearance:auto;-webkit-appearance:checkbox;width:22px!important;min-width:22px!important;max-width:22px!important;height:22px!important;min-height:22px!important;flex:0 0 22px;margin:0;padding:0}
 #view-skill-generator .skg-runtime-name{display:flex;flex-direction:column;min-width:0;max-width:100%;overflow:hidden;line-height:1.2}
 #view-skill-generator .skg-runtime-name b{font-size:.86rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 #view-skill-generator .skg-runtime-name small{font-size:.72rem;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 #view-skill-generator textarea{width:100%;box-sizing:border-box}
 #view-skill-generator .skg-required{font-weight:700}
 #view-skill-generator .skg-required:after{content:' *';color:#b42318}
 #view-skill-generator .skg-result-row{margin:10px 0}
 #view-skill-generator .skg-tags{word-break:break-word}
 #view-skill-generator .skg-effect-stack{display:grid;gap:10px;margin-top:10px}
 #view-skill-generator .skg-effect-card{border:1px solid var(--line,#ddd);border-radius:12px;padding:12px;min-width:0}
 #view-skill-generator .skg-effect-card h3{margin:0 0 10px;font-size:1rem}
 #view-skill-generator .skg-effect-card .grid{margin:0}
 #view-skill-generator .skg-fixed-wrap{display:grid;grid-template-columns:38px minmax(0,1fr);gap:6px;align-items:center}
 #view-skill-generator .skg-fixed-op{display:flex;align-items:center;justify-content:center;min-height:38px;border:1px solid var(--line,#ddd);border-radius:8px;font-weight:800;background:rgba(127,127,127,.08)}
 #view-skill-generator .skg-field-note{display:block;margin-top:4px;font-size:.72rem;opacity:.72}
 #view-skill-generator .skg-progress{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
 #view-skill-generator .skg-progress b{font-size:1.05rem}
 #view-skill-generator .skg-missing{margin-top:6px;font-size:.82rem}
 #view-skill-generator .skg-empty{padding:14px;border:1px dashed var(--line,#bbb);border-radius:10px;text-align:center;opacity:.75}
 #view-skill-generator details.skg-fold{margin-top:10px;border-top:1px solid var(--line,#ddd);padding-top:10px}
 #view-skill-generator details.skg-fold>summary{cursor:pointer;font-weight:700}
 #view-skill-generator .skg-hidden-field{display:none!important}
 #view-skill-generator .skg-condition-list{display:grid;gap:8px;margin-top:10px}
 #view-skill-generator .skg-condition-row{display:grid;grid-template-columns:minmax(0,1.4fr) 70px minmax(84px,.8fr) 42px;gap:6px;align-items:end}
 #view-skill-generator .skg-condition-row select,#view-skill-generator .skg-condition-row input{min-width:0;width:100%;box-sizing:border-box}
 #view-skill-generator .skg-condition-remove{min-width:42px;padding:8px}
 #view-skill-generator .skg-ai-summary{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
 #view-skill-generator .skg-ai-summary .skg-ai-count{padding:7px 10px;border:1px solid var(--line,#ddd);border-radius:999px;font-weight:800}
 #view-skill-generator .skg-ai-filter{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
 #view-skill-generator .skg-ai-filter button[aria-pressed="true"]{font-weight:900;outline:2px solid currentColor}
 #view-skill-generator .skg-ai-gates{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
 #view-skill-generator .skg-ai-gate{padding:4px 7px;border:1px solid var(--line,#ddd);border-radius:7px;font-size:.78rem;font-weight:800}
 #view-skill-generator .skg-ai-issues{display:grid;gap:6px;margin-top:8px}
 #view-skill-generator .skg-ai-issue{padding:8px;border:1px solid var(--line,#ddd);border-radius:8px}
 #view-skill-generator .skg-ai-issue code{font-weight:800}
 #view-skill-generator .skg-ai-numeric{margin-top:8px;padding:8px;border:1px dashed var(--line,#bbb);border-radius:8px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:.75rem}
 #view-skill-generator .skg-ai-hidden{display:none!important}
 @media(max-width:520px){#view-skill-generator .skg-condition-row{grid-template-columns:minmax(0,1fr) 64px minmax(74px,.8fr) 40px;gap:4px}}
 @media(min-width:700px){#view-skill-generator .skg-runtime-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
 `;document.head.appendChild(style);
 s=s||document.createElement('section');s.id='view-skill-generator';s.className=shellVisible?'view':'view hidden';delete s.dataset.skgShell;s.innerHTML=`<div class="view-heading"><div><h1>スキル生成</h1><p class="small">効果を選ぶと、成立に必要な入力項目だけを表示します。効果数値は現行ランタイム仕様どおり固定値「=」で生成します。</p></div></div>
 <div id="skgSkillRegistryStatus" class="item">Skill Registry接続確認中...</div>
 <div class="card skg-step"><h2>① 基本情報</h2><div class="grid"><div class="field"><label class="skg-required">ID</label><input id="skgId" placeholder="SKL-..."></div><div class="field"><label class="skg-required">名称</label><input id="skgName"></div><div class="field"><label>状態</label><select id="skgStatus"><option value="development">development</option><option value="draft">draft</option><option value="adopted">adopted</option></select></div><div class="field"><label>スキルLv</label><input id="skgLevel" type="number" min="0" value="1"></div></div></div>
 <div class="card skg-step"><h2>② Effectを選ぶ</h2><p class="small">現行Skill Registryを正本にしてFormal Effectを選択します。無効なEffectは選択できません。</p><div class="skg-runtime-grid" id="skgFormalEffects">${(skillUiDefinition?.effects||[]).map(x=>`<label title="${esc(x.reason||'')}"><input type="checkbox" value="${esc(x.type)}" ${x.enabled?'':'disabled'}><span class="skg-runtime-name"><b>${esc(x.label||x.type)}</b><small>${esc(x.type)}${x.enabled?'':' / ' + esc(x.boundary||'disabled')}</small></span></label>`).join('')}</div><div id="skgFormalRequirementStatus" class="item" style="margin-top:12px">Effectを選択してください。</div></div>
 <div class="card skg-step"><h2>③ 選択した効果の設定</h2><div id="skgFormalSharedFields" class="skg-effect-stack"></div><div id="skgFormalEffectFields" class="skg-effect-stack"><div class="skg-empty">上でEffectを選択すると、Registry定義から必要な設定だけ表示されます。</div></div><details class="skg-fold" open><summary>発動条件（任意・すべてAND）</summary><p class="small">G03: Condition Registryを正本に scope + property + operator + value を生成します。効果値の固定「=」とは別の比較演算子です。</p><div id="skgFormalConditionList" class="skg-condition-list"></div><div class="toolbar"><button id="skgFormalConditionAdd" type="button">条件を追加</button></div><div id="skgFormalConditionStatus" class="item">条件なし</div></details><details class="skg-fold" open><summary>Skill Budget / Resource</summary><p class="small">G04: 正式Budget Rulesを正本に計算します。既存Skillは自動再計算しません。</p><div class="grid"><div class="field"><label>MP Cost</label><input id="skgFormalMpCost" type="number" min="0" step="any" value="0"></div><div class="field"><label>Cooldown (tick)</label><input id="skgFormalCooldown" type="number" min="0" step="1" value="0"></div><div class="field"><label>Cast Time (tick)</label><input id="skgFormalCastTime" type="number" min="0" step="1" value="0"></div><div class="field"><label>Activation Priority</label><input id="skgFormalActivationPriority" type="number" step="1" value="0"></div></div><div id="skgBudgetStatus" class="item">Budget計算待ち</div><details class="skg-fold"><summary>Budget手動上書き</summary><label><input id="skgBudgetOverride" type="checkbox"> 上限超過を監査付きで許可</label><div class="field"><label>上書き理由</label><input id="skgBudgetOverrideReason" placeholder="理由を8文字以上で記録"></div></details></details><div class="toolbar"><button class="primary" id="skgManualGenerate">生成して検査</button></div><div id="skgManualStatus" class="item">未実行</div></div>
 <div class="card skg-step"><h2>④ 検索・分類</h2><details class="skg-fold"><summary>検索・分類情報を開く</summary><p class="small">ここは戦闘実行には使用しません。検索・AI分類・管理用として保持します。</p><div class="field"><label>検索タグ（カンマ区切り）</label><input id="skgSearchTags" placeholder="炎, ボス用, 魔法"></div><div class="field"><label>説明</label><textarea id="skgDescription" rows="3"></textarea></div></details></div>
 <div class="card skg-step"><h2>⑤ AI一括生成</h2><details class="skg-fold" open><summary>G05 Skill AI Request</summary><p class="small">AIは skillLevel / intent / effects / target / range / randomCount / trigger / conditions / resource / desiredStrength を指定できます。ResourceはFormal calibration入力、power・duration等のEffect完成戦闘数値はStudioがG04 Budget Rulesから決定します。</p><div class="toolbar"><button id="skgAiTemplate">AI Requestテンプレート</button><button id="skgAiRequestExport">AI Request JSON出力</button></div><input id="skgAiFile" type="file" accept=".json,application/json" style="margin:10px 0"><details><summary><b>AI Request JSONを貼り付ける</b></summary><textarea id="skgAiJson" rows="12"></textarea></details><div class="toolbar"><button class="primary" id="skgAiBatchGenerate">Formal Skill一括生成</button></div><div id="skgAiBatchStatus" class="item">未実行</div><p class="small">生成したFormal Skill BatchはそのままG07登録欄へ渡します。Schema / Budget / Compiler / runtimeContracts / Dry Run検査は登録時に一度だけ実行します。</p></details></div>
 <div class="card skg-step"><h2>⑥ 検査結果</h2><div id="skgResult"><div class="item">まだ生成されていません。</div></div></div>
 <div class="card skg-step"><h2>⑦ JSON出力・登録</h2><p class="small">G07: AI一括生成したGKS_SKILL_BATCHを登録時に正式Schema / Budget / Compilerで検査し、ACCEPT行だけをSKL-0000形式で正式採番→runtimeContracts生成→正式Skill Master契約→Data Exchange→Dry Run→Safe Applyの順で登録します。行単位REJECTは除外し、Batch root不一致・既存ID競合は登録を停止します。</p><details class="skg-fold" open><summary>G07 正式Skill Master登録</summary><textarea id="skgG07SkillJson" rows="10" placeholder="GKS_SKILL_BATCH JSON"></textarea><div class="toolbar"><button id="skgG07UseLastSkill" type="button">直近AI Skill Batchをセット</button><button id="skgG07DryRun" type="button">G07登録Dry Run</button><button class="primary" id="skgG07Register" type="button">G07 Safe Apply</button><button id="skgG07Undo" type="button">直前登録をUndo</button></div><div id="skgG07Status" class="item">未実行</div></details></div>`;if(!s.isConnected)workspace.appendChild(s);
 const q=id=>s.querySelector('#'+id);
 const renderSkillRegistryStatus=()=>{const el=q('skgSkillRegistryStatus');if(!el)return;if(!skillUiDefinition){el.textContent='Skill Registry未接続';return;}const enabled=skillUiDefinition.effects.filter(x=>x.enabled).length,total=skillUiDefinition.effects.length;el.innerHTML=`<b>G01 Registry接続:</b> ${esc(skillUiDefinition.registryPhase)} / Effect ${enabled}/${total}有効 / Trigger ${skillUiDefinition.triggers.length} / Condition ${skillUiDefinition.conditions.length} <span class="small">（Formal Effect / Condition / Budget経路）</span>`;};
 renderSkillRegistryStatus();
 function conditionOptionLabel(x){return x.label||x.property;}
 function makeFormalConditionValue(req,current){const ctl=req.valueControl||{},el=ctl.control==='select'?document.createElement('select'):document.createElement('input');el.className='skg-formal-condition-value';if(ctl.control==='select'){for(const value of ctl.options||[]){const o=document.createElement('option');o.value=String(value);o.textContent=String(value);el.appendChild(o);}if(current!==undefined)el.value=String(current);}else{el.type='number';el.step=ctl.step??'any';if(ctl.min!=null)el.min=ctl.min;if(ctl.max!=null)el.max=ctl.max;if(current!==undefined&&current!==null)el.value=String(current);}return el;}
 function refreshFormalConditionRow(row,initial={}){const property=row.querySelector('.skg-formal-condition-property').value,req=skillConditionRequirements(property),scope=row.querySelector('.skg-formal-condition-scope'),op=row.querySelector('.skg-formal-condition-op'),old=row.querySelector('.skg-formal-condition-value');scope.innerHTML='';const so=document.createElement('option');so.value=req.scope||'';so.textContent=req.scope||'未選択';scope.appendChild(so);scope.value=req.scope||'';scope.disabled=!!req.scopeLocked;op.innerHTML='';for(const x of req.operators||[]){const o=document.createElement('option');o.value=x;o.textContent=x;op.appendChild(o);}if(initial.operator&&req.operators?.includes(initial.operator))op.value=initial.operator;const next=makeFormalConditionValue(req,initial.value);old.replaceWith(next);row.dataset.conditionValueType=req.valueType||'';}
 function addFormalConditionRow(initial={}){const row=document.createElement('div');row.className='skg-condition-row skg-formal-condition-row';const scope=document.createElement('select');scope.className='skg-formal-condition-scope';const property=document.createElement('select');property.className='skg-formal-condition-property';property.innerHTML='<option value="">Condition</option>'+(skillUiDefinition?.conditions||[]).filter(x=>x.enabled!==false).map(x=>`<option value="${esc(x.property)}">${esc(conditionOptionLabel(x))}</option>`).join('');property.value=initial.property||'';const op=document.createElement('select');op.className='skg-formal-condition-op';const value=document.createElement('input');value.className='skg-formal-condition-value';value.type='number';const remove=document.createElement('button');remove.type='button';remove.className='skg-condition-remove';remove.textContent='×';remove.title='条件を削除';remove.onclick=()=>{row.remove();updateFormalConditionStatus();};row.append(scope,property,op,value,remove);q('skgFormalConditionList').appendChild(row);property.onchange=()=>{refreshFormalConditionRow(row);updateFormalConditionStatus();};row.addEventListener('input',updateFormalConditionStatus);row.addEventListener('change',updateFormalConditionStatus);if(property.value)refreshFormalConditionRow(row,initial);else{scope.innerHTML='<option value="">scope</option>';op.innerHTML='<option value="">operator</option>';}updateFormalConditionStatus();}
 function collectFormalConditions(){return [...q('skgFormalConditionList').querySelectorAll('.skg-formal-condition-row')].map(row=>{const property=row.querySelector('.skg-formal-condition-property').value;if(!property)return null;const req=skillConditionRequirements(property),el=row.querySelector('.skg-formal-condition-value');let value;if(req.valueType==='predicate')value=el.value==='true';else value=el.value===''?NaN:Number(el.value);return{scope:row.querySelector('.skg-formal-condition-scope').value,property,operator:row.querySelector('.skg-formal-condition-op').value,value};}).filter(Boolean);}
 function validateFormalConditions(){const errors=[],rows=[...q('skgFormalConditionList').querySelectorAll('.skg-formal-condition-row')];for(const [i,row] of rows.entries()){const property=row.querySelector('.skg-formal-condition-property').value;if(!property){errors.push(`conditions[${i}]: propertyが必要です`);continue;}const req=skillConditionRequirements(property),el=row.querySelector('.skg-formal-condition-value');let value=req.valueType==='predicate'?el.value==='true':(el.value===''?NaN:Number(el.value));const c={scope:row.querySelector('.skg-formal-condition-scope').value,property,operator:row.querySelector('.skg-formal-condition-op').value,value},r=global.GKSSkillAuthoringRegistry.validateConditionDraft(skillRegistry,c);for(const msg of r.errors||[])errors.push(`conditions[${i}]: ${msg}`);}return errors;}
 function updateFormalConditionStatus(){const el=q('skgFormalConditionStatus');if(!el)return;const rows=q('skgFormalConditionList').querySelectorAll('.skg-formal-condition-row').length,errors=validateFormalConditions();el.innerHTML=errors.length?`<div class="skg-missing">${errors.map(esc).join('<br>')}</div>`:`<div class="skg-missing">✓ Condition ${rows}件 / Registry検査PASS</div>`;if(selectedFormal().length)updateFormalReqStatus();}
 q('skgFormalConditionAdd').onclick=()=>addFormalConditionRow();
 q('skgFormalEffects').addEventListener('change',renderSkillDynamic);
 q('skgFormalEffectFields').addEventListener('change',e=>{if(e.target?.dataset?.formalField==='effectId'||e.target?.dataset?.formalField==='lifetime'){captureFormalValues();renderSkillDynamic();}else{captureFormalValues();updateFormalReqStatus();}});
 for(const id of ['skgFormalMpCost','skgFormalCooldown','skgFormalCastTime','skgFormalActivationPriority','skgBudgetOverride','skgBudgetOverrideReason','skgLevel'])q(id)?.addEventListener('input',updateFormalReqStatus);
 q('skgBudgetOverride')?.addEventListener('change',updateFormalReqStatus);
 s.addEventListener('input',e=>{if(e.target?.id==='skgId'||e.target?.id==='skgName'||e.target?.id==='skgDescription'||e.target?.id==='skgSearchTags')updateFormalReqStatus();});
 const formalDraftCache={};
 function selectedFormal(){return [...q('skgFormalEffects').querySelectorAll('input:checked')].map(x=>x.value)}
 function captureFormalValues(){for(const card of q('skgFormalEffectFields').querySelectorAll('[data-formal-effect]')){const type=card.dataset.formalEffect,values={};for(const el of card.querySelectorAll('[data-formal-field]')){let v=el.value;if(el.dataset.control==='number'&&v!=='')v=Number(v);if(el.dataset.control==='boolean')v=v==='true';if(el.dataset.control==='json'&&v!==''){try{v=JSON.parse(v)}catch{}}values[el.dataset.formalField]=v;}formalDraftCache[type]=values;}}
 function formalOptions(field,req){const supported=req?.supportedValues?.[field];if(Array.isArray(supported))return supported.map(v=>({value:v,label:v}));if(field==='effectId')return (skillUiDefinition?.applyEffects||[]).map(x=>({value:x.effectId,label:x.label||x.effectId}));if(field==='damageType')return skillUiDefinition?.damageTypes||[];return[];}
 function makeFormalField(type,field,required,req){const meta=skillUiDefinition?.fields?.[field]||{label:field,control:'text'},wrap=document.createElement('div');wrap.className='field';const lab=document.createElement('label');lab.textContent=meta.label||field;if(required)lab.classList.add('skg-required');const current=formalDraftCache[type]?.[field];let el;if(meta.control==='select'||meta.control==='boolean'){el=document.createElement('select');el.innerHTML='<option value="">未選択</option>';const opts=meta.control==='boolean'?[{value:'true',label:'true'},{value:'false',label:'false'}]:formalOptions(field,req);for(const o of opts){const op=document.createElement('option');op.value=o.value;op.textContent=o.label;el.appendChild(op);}if(current!==undefined&&current!==null)el.value=String(current);}else if(meta.control==='json'){el=document.createElement('textarea');el.rows=3;if(meta.placeholder)el.placeholder=meta.placeholder;if(current!==undefined&&current!==null)el.value=typeof current==='string'?current:JSON.stringify(current);}else{el=document.createElement('input');el.type=meta.control==='number'?'number':'text';if(meta.step!=null)el.step=meta.step;if(meta.min!=null)el.min=meta.min;if(meta.max!=null)el.max=meta.max;if(current!==undefined&&current!==null)el.value=String(current);}el.dataset.formalField=field;el.dataset.control=meta.control||'text';wrap.append(lab,el);return wrap;}
 function renderFormalShared(){const host=q('skgFormalSharedFields');host.innerHTML='';if(!selectedFormal().length)return;const card=document.createElement('div');card.className='skg-effect-card';card.innerHTML='<h3>Skill共通設定</h3><div class="grid"></div>';const g=card.querySelector('.grid');const mk=(label,id,items,def)=>{const w=document.createElement('div');w.className='field';const l=document.createElement('label');l.className='skg-required';l.textContent=label;const sel=document.createElement('select');sel.id=id;for(const x of items){const o=document.createElement('option');o.value=x.value??x.type;o.textContent=x.label??x.type??x.value;sel.appendChild(o);}if([...sel.options].some(o=>o.value===def))sel.value=def;w.append(l,sel);g.appendChild(w);};mk('Trigger','skgFormalTrigger',(skillUiDefinition?.triggers||[]).filter(x=>x.enabled!==false).map(x=>({value:x.type,label:x.type})),'ON_USE');mk('対象','skgFormalTargetSide',skillUiDefinition?.targets?.sides||[],'ENEMY');mk('範囲','skgFormalTargetRange',skillUiDefinition?.targets?.ranges||[],'SINGLE');host.appendChild(card);}
 function renderSkillDynamic(){captureFormalValues();renderFormalShared();const host=q('skgFormalEffectFields');host.innerHTML='';const types=selectedFormal();for(const type of types){const cached=formalDraftCache[type]||{};const req=skillEffectRequirements(type,cached);const card=document.createElement('div');card.className='skg-effect-card';card.dataset.formalEffect=type;card.innerHTML=`<h3>${esc(req.label||type)} <span class="small">${esc(type)}</span></h3><div class="grid"></div>`;const g=card.querySelector('.grid'),fields=[...req.requiredFields,...req.optionalFields.filter(x=>!req.requiredFields.includes(x))];for(const f of fields)g.appendChild(makeFormalField(type,f,req.requiredFields.includes(f),req));host.appendChild(card);}if(!types.length)host.innerHTML='<div class="skg-empty">上でEffectを選択すると、Registry定義から必要な設定だけ表示されます。</div>';updateFormalReqStatus();}
 function collectFormalEffects(){captureFormalValues();return selectedFormal().map(type=>{const src=formalDraftCache[type]||{},o={type};for(const [k,v] of Object.entries(src)){if(v===''||v==null)continue;o[k]=v;}return o;});}
 function buildFormalDraft(){return{schemaVersion:1,id:q('skgId').value.trim(),name:q('skgName').value.trim(),skillLevel:Number(q('skgLevel').value)||1,trigger:{type:q('skgFormalTrigger')?.value||'ON_USE',scope:'SELF'},conditions:collectFormalConditions(),target:{side:q('skgFormalTargetSide')?.value||'',range:q('skgFormalTargetRange')?.value||''},effects:collectFormalEffects(),resource:{mpCost:Number(q('skgFormalMpCost')?.value)||0,cooldown:Number(q('skgFormalCooldown')?.value)||0,activationPriority:Number(q('skgFormalActivationPriority')?.value)||0,castTime:Number(q('skgFormalCastTime')?.value)||0}};}
 function updateFormalReqStatus(){const types=selectedFormal(),status=q('skgFormalRequirementStatus');if(!types.length){status.textContent='Effectを選択してください。';q('skgManualGenerate').disabled=true;return;}const missing=[];for(const type of types){const vals=formalDraftCache[type]||{},req=skillEffectRequirements(type,vals);for(const f of req.requiredFields)if(!present(vals[f]))missing.push(`${type}.${f}`);for(const group of req.oneOfRequired||[])if(!group.some(f=>present(vals[f])))missing.push(`${type}.(${group.join(' または ')})`);}if(!q('skgId').value.trim())missing.unshift('id');if(!q('skgName').value.trim())missing.unshift('name');const conditionErrors=validateFormalConditions();let budget=null,budgetErrors=[];try{if(budgetRules){budget=calculateSkillBudget(buildFormalDraft(),{manualOverride:q('skgBudgetOverride')?.checked===true,overrideReason:q('skgBudgetOverrideReason')?.value||''});budgetErrors=budget.errors||[];const b=q('skgBudgetStatus');if(b)b.innerHTML=`<b>${esc(budget.budgetRuleVersion)}</b> cost ${budget.cost} / limit ${budget.limit} ${budget.ok?'✓ ACCEPT':'✗ REJECT'}${budget.manualOverrideApplied?' / OVERRIDE AUDITED':''}`;}}catch(e){budgetErrors=[e.message];}status.innerHTML=missing.length?`<div class="skg-missing">未入力: ${missing.map(esc).join(' / ')}</div>`:conditionErrors.length?`<div class="skg-missing">Conditionエラー: ${conditionErrors.map(esc).join(' / ')}</div>`:budgetErrors.length?`<div class="skg-missing">Budgetエラー: ${budgetErrors.map(esc).join(' / ')}</div>`:'<div class="skg-missing">✓ Skill必須項目・Condition・Budgetが揃っています。</div>';q('skgManualGenerate').disabled=missing.length>0||conditionErrors.length>0||budgetErrors.length>0;}
 async function generateFormalPreview(){const draft=buildFormalDraft(),budget=calculateSkillBudget(draft,{manualOverride:q('skgBudgetOverride')?.checked===true,overrideReason:q('skgBudgetOverrideReason')?.value||''}),compiled=await compileSkillDraft(draft),now=stamp();const record={...clone(compiled.compiledSkill||draft),status:q('skgStatus').value,description:q('skgDescription').value,created_at:now,updated_at:now};const errors=[...(compiled.errors||[]).map(x=>({field:x.path||'skill',code:x.code||'SKILL_COMPILE_REJECTED',message:x.message||String(x)})),...(budget.errors||[]).map(message=>({field:'budget',code:String(message).startsWith('SKILL_BUDGET_EXCEEDED')?'SKILL_BUDGET_EXCEEDED':'BUDGET_REJECTED',message}))];const ok=compiled.ok&&budget.ok;return{entries:[{input:draft,record,validation:{ok,errors,warnings:compiled.warnings||[],logicOrder:[],budget}}],summary:{count:1,valid:ok?1:0,invalid:ok?0:1}};}
 function renderFormalPreview(p){const r=q('skgResult'),entries=p?.entries||[];r.innerHTML=`<div class="item"><b>${entries.length}件</b> / 正常 ${p.summary.valid} / エラー ${p.summary.invalid}</div>`+entries.map(e=>{const budget=e.validation?.budget||{},contracts=e.record?.runtimeContracts||{};return `<details class="card skg-result-row" ${e.validation.ok?'':'open'}><summary><b>${esc(e.record?.id||'(IDなし)')}</b> ${esc(e.record?.name||'')} ${e.validation.ok?'✓ 正常':'⚠ エラー'}</summary><div class="small">Formal Compiler: ${e.validation.ok?'PASS':'REJECT'} / Budget ${esc(budget.cost??'-')} / ${esc(budget.limit??'-')}</div><div class="small">runtimeContracts: ${esc(Object.keys(contracts).join(', ')||'none')}</div>${e.validation.errors.length?`<div class="item">${e.validation.errors.map(x=>'・'+esc(x.message)).join('<br>')}</div>`:''}</details>`;}).join('');}
 q('skgManualGenerate').onclick=async()=>{try{const result=await generateFormalPreview();renderFormalPreview(result);q('skgManualStatus').textContent=result.summary.invalid?'Formal検査REJECT。入力を確認してください。':'Formal Skill生成・Compiler/Budget検査PASS。';}catch(e){q('skgManualStatus').textContent='Formal生成エラー: '+e.message;}};
 function aiGateLabel(name,value){return `<span class="skg-ai-gate">${esc(name)} ${value?'✓ PASS':'✗ FAIL'}</span>`;}
 function aiNumericPreview(e){if(!e?.skill)return '';const budget=e.validation?.budgetResult||{},effects=(e.skill.effects||[]).map((x,i)=>({index:i,...x}));return JSON.stringify({effects,resource:e.skill.resource||{},budget:{cost:budget.totalCost??null,limit:budget.limit??null,ruleVersion:budget.budgetRuleVersion||''}},null,2);}
 function renderAiBatch(result){const r=q('skgResult'),entries=result?.entries||[],summary=result?.summary||{};r.innerHTML=`<div class="item"><div class="skg-ai-summary"><b>G05 AI Batch</b><span class="skg-ai-count">TOTAL ${summary.total??entries.length}</span><span class="skg-ai-count">ACCEPT ${summary.accepted||0}</span><span class="skg-ai-count">REJECT ${summary.rejected||0}</span></div><div class="small">${esc(result?.aiGenerationRuleVersion||'')} / ${esc(result?.budgetRuleVersion||'')}</div><div class="skg-ai-filter" role="group" aria-label="AI一括生成結果フィルター"><button type="button" data-ai-batch-filter="ALL" aria-pressed="true">すべて</button><button type="button" data-ai-batch-filter="ACCEPT" aria-pressed="false">ACCEPTのみ</button><button type="button" data-ai-batch-filter="REJECT" aria-pressed="false">REJECTのみ</button></div></div>`+entries.map(e=>{const issues=e.validation?.issues||[],budget=e.validation?.budgetResult||{},numeric=aiNumericPreview(e);return `<details class="card skg-result-row skg-ai-result" data-ai-batch-status="${esc(e.status)}" ${e.status==='ACCEPT'?'':'open'}><summary><b>#${Number(e.index)+1} ${esc(e.skill?.id||`request[${e.index}]`)}</b> ${esc(e.skill?.name||e.request?.intent||'')} ${e.status==='ACCEPT'?'✓ ACCEPT':'✗ REJECT'}</summary><div class="skg-ai-gates">${aiGateLabel('Registry',!!e.validation?.registry)}${aiGateLabel('Budget',!!e.validation?.budget)}${aiGateLabel('Compiler',!!e.validation?.compiler)}</div>${e.generation?`<div class="small">${esc(e.generation.aiGenerationRuleVersion)} / desiredStrength ${esc(e.generation.desiredStrength)} / targetBudget ${esc(e.generation.targetBudget)} / budget ${esc(budget.totalCost??'-')} / limit ${esc(budget.limit??'-')}</div>`:''}${e.skill?`<div class="small skg-tags">effects: ${esc((e.skill.effects||[]).map(x=>x.type+(x.effectId?`:${x.effectId}`:'')).join(', '))}</div>`:'<div class="small">生成Skillなし（構造検査または生成前GateでREJECT）</div>'}${issues.length?`<div class="skg-ai-issues">${issues.map(x=>`<div class="skg-ai-issue"><code>${esc(x.code||'REJECT')}</code>${x.path?` <span class="small">@ ${esc(x.path)}</span>`:''}<div>${esc(x.message||'')}</div></div>`).join('')}</div>`:'<div class="small">個別検査PASS。完成戦闘数値はStudio生成値です。</div>'}${numeric?`<details class="skg-fold"><summary>Studio生成数値 / Budget trace</summary><pre class="skg-ai-numeric">${esc(numeric)}</pre></details>`:''}</details>`;}).join('');
  r.querySelectorAll('[data-ai-batch-filter]').forEach(btn=>btn.onclick=()=>{const mode=btn.dataset.aiBatchFilter;r.querySelectorAll('[data-ai-batch-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));r.querySelectorAll('[data-ai-batch-status]').forEach(row=>row.classList.toggle('skg-ai-hidden',mode!=='ALL'&&row.dataset.aiBatchStatus!==mode));});
 }
 q('skgAiTemplate').onclick=()=>{q('skgAiJson').value=JSON.stringify(aiRequestTemplate(),null,2);q('skgAiBatchStatus').textContent='AI Requestテンプレートを設定しました。';};
 q('skgAiRequestExport').onclick=()=>{try{const payload=exportAiRequest(JSON.parse(q('skgAiJson').value||JSON.stringify(aiRequestTemplate())));download('Skill_AI_Request.json',payload);q('skgAiBatchStatus').textContent='AI Request JSONを出力しました。';}catch(err){q('skgAiBatchStatus').textContent='出力エラー: '+err.message;}};
 q('skgAiFile').onchange=async e=>{try{const f=e.target.files?.[0];if(f){const payload=assertJsonObjectSchema(JSON.parse(await f.text()),'GKS_SKILL_AI_BATCH_REQUEST');q('skgAiJson').value=JSON.stringify(payload,null,2);q('skgAiBatchStatus').textContent=f.name+' をAI Requestとして読み込みました。';}}catch(err){q('skgAiBatchStatus').textContent='読込REJECT ['+(err.code||'JSON_INVALID')+']: '+err.message;}};
 q('skgAiBatchGenerate').onclick=async()=>{try{const result=await generateSkillAiBatch(assertJsonObjectSchema(JSON.parse(q('skgAiJson').value||'{}'),'GKS_SKILL_AI_BATCH_REQUEST'));renderAiBatch(result);const batch=clone(lastFormalSkillBatch);if(batch&&q('skgG07SkillJson'))q('skgG07SkillJson').value=JSON.stringify(batch,null,2);q('skgAiBatchStatus').innerHTML=`<b>${esc(result.aiGenerationRuleVersion)}</b> / Formal Draft ${result.summary.accepted}件<br><span class="small">正式なBudget / Compiler / runtimeContracts / Data Exchange検査はG07登録時に一度だけ実行します。</span>`;if(q('skgG07Status'))q('skgG07Status').textContent='AI一括生成結果を登録欄へセットしました。G07登録Dry Runで正式検査してください。';}catch(e){q('skgAiBatchStatus').textContent='AI一括生成エラー: '+e.message;}};
 
 q('skgG07UseLastSkill').onclick=()=>{try{let payload=lastFormalSkillBatch?clone(lastFormalSkillBatch):buildFormalSkillBatch();payload=g07NormalizeSkillBatch(payload);q('skgG07SkillJson').value=JSON.stringify(payload,null,2);q('skgG07Status').textContent='直近のAI一括生成結果を正式GKS_SKILL_BATCHとしてG07登録欄へセットしました。';}catch(e){q('skgG07Status').textContent='G07準備REJECT ['+(e.code||'ERROR')+']: '+e.message;}};
 q('skgG07DryRun').onclick=async()=>{try{const payload=JSON.parse(q('skgG07SkillJson').value||'{}');const out=await g07DryRunMasterRegistration(payload);q('skgG07Status').innerHTML=`<b>G07 Dry Run PASS</b> add ${out.dryRun.summary?.add||0} / rejected ${out.revalidation?.summary?.rejected||0} / conflict 0<br><span class="small">ACCEPT行だけを正式IDで採番し、Schema・Budget・Compiler・runtimeContracts・正式Skill Master契約・Dry Run・Apply Plan検査を通過しました。REJECT行は登録対象から除外しています。まだMasterへ書き込みません。</span>`;}catch(e){q('skgG07Status').innerHTML=e.g07Blocker?g07FormatBlocker(e.g07Blocker):esc('G07 Dry Run REJECT ['+(e.code||'ERROR')+']: '+e.message);}};
 q('skgG07Register').onclick=async()=>{try{const payload=JSON.parse(q('skgG07SkillJson').value||'{}');const out=await g07SafeApplySkillBatch(payload);q('skgG07Status').innerHTML=`<b>G07 Safe Apply 完了</b> add ${out.plan?.add_count||out.dryRun.summary?.add||0} / rejected ${out.revalidation?.summary?.rejected||0}<br><span class="small">REJECT行を除外し、backup / transaction / persist / Audit記録まで完了。直前SessionはUndoできます。</span>`;}catch(e){q('skgG07Status').innerHTML=e.g07Blocker?g07FormatBlocker(e.g07Blocker):esc('G07登録REJECT ['+(e.code||'ERROR')+']: '+e.message);}};
 q('skgG07Undo').onclick=async()=>{try{if(!global.GKSDataExchangeUI?.undoLatestSession)throw Object.assign(new Error('Data Exchange Undo UIがありません'),{code:'G07_UNDO_UI_REQUIRED'});q('skgG07Status').textContent='Data Exchange Auditの直前Session Undoを実行中です。';const out=await global.GKSDataExchangeUI.undoLatestSession();if(!out)return;const undone=out.undone_count||0,remain=out.remain_count||0,conflict=out.conflict_count||0;q('skgG07Status').innerHTML=`<b>G07 Undo 完了</b> success ${undone}<br><span class="small">undone ${undone} / remain ${remain} / conflict ${conflict}<br>backup / transaction / persist / Audit記録まで完了。現在のMasterは登録前の状態に戻っています。</span>`;}catch(e){q('skgG07Status').textContent='G07 Undo REJECT ['+(e.code||'ERROR')+']: '+e.message;}};
 renderSkillDynamic();document.dispatchEvent(new CustomEvent('gks:view-ready',{detail:{view:'skill-generator'}}));
}
async function compileSkillDraft(skill,options={}){const service=global.GKSSkillCompileService;if(!service?.compileSkill)throw new Error('Skill Compile Serviceが読み込まれていません');return service.compileSkill(skill,{registry:skillRegistry,...options});}
const api={VERSION,DEPENDENCY_TIMEOUT_MS,fetchJsonDependency,loadSkillDefinition,loadBudgetRules,loadAiGenerationRules,calculateSkillBudget,aiRequestTemplate,generateSkillAiBatch,exportAiRequest,buildFormalSkillBatch,assertJsonObjectSchema,g07AssertFormalMasterContract,g07ValidateFormalSkillRuntime,g07NormalizeSkillBatch,g07AllocateFormalSkillIds,g07RevalidateSkillBatch,g07BuildMasterEnvelopeFromSkillBatch,g07DryRunBlocker,g07FormatBlocker,g07AuditStorageKey,g07DryRunMasterRegistration,g07SafeApplySkillBatch,skillEffectRequirements,skillConditionRequirements,compileSkillDraft,getSkillUiDefinition:()=>clone(skillUiDefinition),getBudgetRules:()=>clone(budgetRules),getAiGenerationRules:()=>clone(aiGenerationRules),getAiBatchPreview:()=>clone(aiBatchPreview)};global.GKSSkillGenerator=api;
function setBootStatus(message,kind='info'){const view=document.getElementById('view-skill-generator');if(!view||view.dataset.skgShell!=='loading')return;const el=view.querySelector('#skgBootStatus');if(el){el.textContent=message;el.dataset.status=kind;}}
async function boot(){
 bootDiag('BOOT-4: boot entered');
 setBootStatus('Registry / Budget / AI定義を読み込み中です。');
 const tasks=[['Skill Registry',loadSkillDefinition()],['Budget Rules',loadBudgetRules()],['AI Rules',loadAiGenerationRules()]];
 const settled=await Promise.allSettled(tasks.map(x=>x[1])),failed=settled.map((r,i)=>r.status==='rejected'?{name:tasks[i][0],reason:r.reason}:null).filter(Boolean);
 if(failed.length){bootDiag('BOOT-X: dependency failure aggregate');const message=failed.map(x=>`${x.name}: ${x.reason?.message||x.reason}`).join(' / ');console.error('[SkillGenerator] dependency load failed',failed);setBootStatus('初期化停止: '+message,'error');document.dispatchEvent(new CustomEvent('gks:view-ready',{detail:{view:'skill-generator'}}));return;}
 bootDiag('BOOT-5: dependencies complete');
 renderPanel();
 bootDiag('BOOT-6: panel rendered');
}
bootDiag(`BOOT-3A: readyState=${document.readyState}`);
if(document.readyState==='loading'){bootDiag('BOOT-3B: waiting DOMContentLoaded');document.addEventListener('DOMContentLoaded',boot);}else{bootDiag('BOOT-3B: boot immediate');boot();}
})(window);
