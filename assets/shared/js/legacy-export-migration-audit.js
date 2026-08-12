/* GKS Legacy Export Migration Audit — R06-C. Read-only classification; never mutates project data. */
(function(root){
'use strict';
const VERSION='R06-C';
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function text(v){return String(v==null?'':v)}
function testLike(skill){const s=[skill?.id,skill?.name,skill?.description].map(text).join(' ');return /(^|[-_])TEST([-_]|$)|VALIDATION|(^|[-_])DEV([-_]|$)|検証|テスト|不正/i.test(s)||/^dev/i.test(text(skill?.id));}
function auditLegacyExport({exportEnvelope,projectData,currentGameBuild,currentStudioBuild,migration,registry,legacyCompile,genericCompile}={}){
 const before=JSON.stringify(projectData||{}), rows=Array.isArray(exportEnvelope?.data)?exportEnvelope.data:[], masterSkills=Array.isArray(projectData?.masters?.skills)?projectData.masters.skills:[];
 const source={data_version:exportEnvelope?.data_version||null,generated_by:exportEnvelope?.generated_by||null,generated_at:exportEnvelope?.generated_at||null,count:rows.length};
 const sourceCurrent=!!currentGameBuild&&!!currentStudioBuild&&text(source.data_version).includes(text(currentGameBuild))&&text(source.generated_by).includes(text(currentStudioBuild));
 const items=rows.map(skill=>{
  const environment=text(skill?.environment||'production').toLowerCase()||'production';
  let dry={ok:false,issues:[{code:'NO_TAGGED_DEFINITION',message:'tags array missing'}]};
  if(Array.isArray(skill?.tags)&&migration?.dryRunLegacySkill) dry=migration.dryRunLegacySkill(skill,{registry,legacyCompile,genericCompile});
  const eligibleEnvironment=environment==='production';
  const convertible=!!dry.ok;
  const isTestLike=testLike(skill);
  const promotionCandidate=eligibleEnvironment&&convertible;
  const promotionReady=promotionCandidate&&sourceCurrent&&!isTestLike;
  const reasons=[];
  if(!eligibleEnvironment)reasons.push(environment==='validation'?'VALIDATION_ONLY':'DEVELOPMENT_ONLY');
  if(eligibleEnvironment&&!convertible)reasons.push(...(dry.issues||[]).map(x=>x.code||'MIGRATION_BLOCKED'));
  if(promotionCandidate&&!sourceCurrent)reasons.push('SOURCE_NOT_CURRENT');
  if(promotionCandidate&&isTestLike)reasons.push('TEST_OR_VALIDATION_NAMING');
  return{id:text(skill?.id),name:text(skill?.name),environment,has_tags:Array.isArray(skill?.tags),convertible,promotion_candidate:promotionCandidate,promotion_ready:promotionReady,test_like:isTestLike,reasons:[...new Set(reasons)],issues:clone(dry.issues||[])};
 });
 const count=(fn)=>items.filter(fn).length;
 const summary={total:items.length,production_convertible:count(x=>x.environment==='production'&&x.convertible),production_blocked:count(x=>x.environment==='production'&&!x.convertible),validation_only:count(x=>x.environment==='validation'),development_only:count(x=>x.environment==='development'),promotion_candidates:count(x=>x.promotion_candidate),promotion_ready:count(x=>x.promotion_ready),source_current:sourceCurrent,project_master_skill_count:masterSkills.length,mutated:before!==JSON.stringify(projectData||{})};
 const issues=[];
 if(summary.mutated)issues.push({code:'PROJECT_DATA_MUTATED',message:'Dry Run audit mutated project data'});
 if(summary.promotion_ready>0&&masterSkills.length===0)issues.push({code:'PROMOTION_REQUIRES_EXPLICIT_IMPORT',message:'Promotion-ready rows must still be imported through the Studio Data Exchange path'});
 return{version:VERSION,mode:'READ_ONLY_AUDIT',source,expected:{game_build:currentGameBuild||null,studio_build:currentStudioBuild||null},summary,items,issues};
}
const api={VERSION,auditLegacyExport};root.GKSLegacyExportMigrationAudit=Object.freeze(api);if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
