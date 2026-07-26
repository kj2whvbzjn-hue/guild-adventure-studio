(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GKBootstrapCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const LEVELS=['UNINITIALIZED','CONTEXT_READY','ANALYSIS_READY','IMPLEMENTATION_READY','VERIFICATION_READY','SUBMISSION_READY','BLOCKED'];
function isObject(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
function readiness(ctx){return ctx&&ctx.startup&&(ctx.startup.level||ctx.startup.status)||'UNINITIALIZED'}
function blockers(ctx){return Array.isArray(ctx&&ctx.startup&&ctx.startup.blocking_issues)?ctx.startup.blocking_issues:[]}
function warnings(ctx){return Array.isArray(ctx&&ctx.startup&&ctx.startup.warnings)?ctx.startup.warnings:[]}
function validate(ctx){
 const e=[];
 if(!isObject(ctx))return [{code:'CTX_OBJECT_REQUIRED',message:'Bootstrap ContextはJSON objectである必要があります。'}];
 if(typeof ctx.schema_version!=='string'||!ctx.schema_version.trim())e.push({code:'SCHEMA_VERSION_MISSING',message:'schema_versionがありません。'});
 if(!isObject(ctx.project))e.push({code:'PROJECT_MISSING',message:'projectがありません。'});
 else {if(!ctx.project.id&&!ctx.project.name)e.push({code:'PROJECT_IDENTITY_MISSING',message:'project.idまたはproject.nameが必要です。'});if(ctx.project.build===undefined||ctx.project.build===null||ctx.project.build==='')e.push({code:'PROJECT_BUILD_MISSING',message:'project.buildがありません。'});}
 if(!isObject(ctx.authority))e.push({code:'AUTHORITY_MISSING',message:'authorityがありません。'});
 else {
  const write=ctx.authority.repository_write||ctx.authority.deployment_authority;
  if(write!=='human_only')e.push({code:'REPOSITORY_WRITE_NOT_HUMAN_ONLY',message:'repository write authorityはhuman_onlyである必要があります。'});
  if(ctx.authority.ai_self_approval===true)e.push({code:'AI_SELF_APPROVAL_FORBIDDEN',message:'AIの自己承認は許可されません。'});
 }
 if(!isObject(ctx.startup))e.push({code:'STARTUP_MISSING',message:'startupがありません。'});
 else {
  const level=readiness(ctx);if(!LEVELS.includes(level))e.push({code:'STARTUP_LEVEL_INVALID',message:'startup.levelが定義済み状態ではありません。'});
  if(ctx.startup.blocking_issues!==undefined&&!Array.isArray(ctx.startup.blocking_issues))e.push({code:'BLOCKING_ISSUES_NOT_ARRAY',message:'startup.blocking_issuesは配列である必要があります。'});
  if(ctx.startup.warnings!==undefined&&!Array.isArray(ctx.startup.warnings))e.push({code:'WARNINGS_NOT_ARRAY',message:'startup.warningsは配列である必要があります。'});
  if(level==='IMPLEMENTATION_READY'&&blockers(ctx).length)e.push({code:'READY_WITH_BLOCKERS',message:'IMPLEMENTATION_READYにBlocking Issueを含めることはできません。'});
  if(level==='BLOCKED'&&!blockers(ctx).length)e.push({code:'BLOCKED_WITHOUT_ISSUE',message:'BLOCKEDには1件以上のBlocking Issueが必要です。'});
 }
 if(ctx.approved_decisions!==undefined&&!Array.isArray(ctx.approved_decisions))e.push({code:'DECISIONS_NOT_ARRAY',message:'approved_decisionsは配列である必要があります。'});
 return e;
}
function summary(ctx){const errors=validate(ctx);return {level:readiness(ctx),blocking_count:blockers(ctx).length,warning_count:warnings(ctx).length,error_count:errors.length,valid:errors.length===0,errors};}
return {LEVELS,readiness,blockers,warnings,validate,summary};
});
