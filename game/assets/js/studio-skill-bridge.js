/* Studio skill data bridge — GKS-B484 / P01-01 HEAL */
const STUDIO_SKILL_EXPORT_URL=window.GA_PROJECT_CONFIG.skillExportUrl;
const studioSkillBridge={status:'idle',source_url:STUDIO_SKILL_EXPORT_URL,schema_version:null,data_version:null,generated_by:null,imported_ids:[],errors:[],loaded_at:null};
function normalizeStudioTagSkill(record){
 if(!record||typeof record!=='object')return null;
 const tags=Array.isArray(record.tags)?record.tags.map(x=>String(x).trim()).filter(Boolean):[];
 if(!record.id||!record.name||!tags.length)return null;
 return{id:String(record.id),name:String(record.name),tags,source:'studio_export',environment:record.environment||'production',definition_format:record.definition_format||'tag_v1'};
}
async function loadStudioSkillDefinitions(){
 studioSkillBridge.status='loading';studioSkillBridge.errors=[];
 try{
  const response=await fetch(STUDIO_SKILL_EXPORT_URL,{cache:'no-store'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const payload=await response.json(),rows=Array.isArray(payload)?payload:(Array.isArray(payload?.data)?payload.data:[]);
  const imported=rows.map(normalizeStudioTagSkill).filter(Boolean);
  if(!imported.length)throw new Error('タグ定義スキルが0件です');
  for(const skill of imported){const i=TAG_SKILLS.findIndex(x=>x.id===skill.id);if(i>=0)TAG_SKILLS.splice(i,1,skill);else TAG_SKILLS.push(skill)}
  studioSkillBridge.status='loaded';studioSkillBridge.schema_version=payload?.schema_version||null;studioSkillBridge.data_version=payload?.data_version||null;studioSkillBridge.generated_by=payload?.generated_by||null;studioSkillBridge.imported_ids=imported.map(x=>x.id);studioSkillBridge.loaded_at=new Date().toISOString();
  if(typeof populateTagSkillTestUI==='function')populateTagSkillTestUI();
  if(typeof renderCharacterSkills==='function')renderCharacterSkills();
  return studioSkillBridge;
 }catch(error){studioSkillBridge.status='failed';studioSkillBridge.errors=[String(error?.message||error)];return studioSkillBridge}
}
function buildStudioBridgeValidationReport(){
 const required=['SKL-TEST-ATTACK','SKL-TEST-POISON','SKL-TEST-BUFF-10','SKL-TEST-DEBUFF-10','SKL-TEST-FOLLOW-POISON','SKL-TEST-HEAL-100','SKL-TEST-HEAL-ALL-60','SKL-TEST-SHIELD-100','SKL-TEST-SHIELD-ALL-60'];
 const compile_results=required.map(id=>{const skill=findTagSkill(id),compiled=skill?compileTaggedSkill(skill):null;return{id,found:!!skill,source:skill?.source||'embedded',tags:skill?.tags||[],compiled_ok:!!compiled?.ok,logic_order:compiled?.definition?.logicOrder||[],errors:compiled?.errors||['skill not found']}});
 const errors=[];
 if(studioSkillBridge.status!=='loaded')errors.push(`Studio出力未読込: ${studioSkillBridge.status}`);
 for(const row of compile_results){if(!row.found)errors.push(`${row.id}が見つかりません`);else if(row.source!=='studio_export')errors.push(`${row.id}がStudio出力由来ではありません`);else if(!row.compiled_ok)errors.push(`${row.id}のコンパイル失敗`)}
 return{schema_version:'1.0.0',build:'GA-B486.2',generated_at:new Date().toISOString(),test:{id:'TAG-STUDIO-EXPORT-BRIDGE-001',mode:'formal_data_bridge'},source:{url:studioSkillBridge.source_url,status:studioSkillBridge.status,schema_version:studioSkillBridge.schema_version,data_version:studioSkillBridge.data_version,generated_by:studioSkillBridge.generated_by,loaded_at:studioSkillBridge.loaded_at,imported_count:studioSkillBridge.imported_ids.length,imported_ids:[...studioSkillBridge.imported_ids]},compile_results,summary:{required_count:required.length,studio_sourced_count:compile_results.filter(x=>x.source==='studio_export').length,compiled_count:compile_results.filter(x=>x.compiled_ok).length,passed:errors.length===0,errors:[...studioSkillBridge.errors,...errors]}};
}
function downloadStudioBridgeValidationJson(){const report=buildStudioBridgeValidationReport(),blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-studio-bridge-validation-GA-B486.2-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);return report}

function formalShieldSnapshot(unit){return{id:unit?.id||null,hp:unit?.hp??null,max_hp:unit?.maxHp??null,alive:!!unit?.alive,shield_total:typeof shieldTotal==='function'?shieldTotal(unit):null,shield_effects:typeof ensureShieldEffects==='function'?ensureShieldEffects(unit).map(x=>({id:x.id,skill_id:x.skillId,remaining:x.remaining,applied_at:x.appliedAt,expires_at:x.expiresAt})):[]}}
function runFormalShieldRuntimeRegression(){
 const cases=[],errors=[];
 const add=(id,label,fn)=>{try{const result=fn(),row={id,label,...result};row.passed=(row.errors||[]).length===0;cases.push(row);if(!row.passed)errors.push(...row.errors.map(x=>`${id}: ${x}`))}catch(error){const message=String(error?.message||error);cases.push({id,label,passed:false,errors:[message]});errors.push(`${id}: ${message}`)}};
 const requireSkill=id=>{const skill=findTagSkill(id);if(!skill)throw new Error(`${id}がありません`);if(skill.source!=='studio_export'||(skill.environment||'production')!=='production')throw new Error(`${id}がStudio production由来ではありません`);return skill};
 const prepare=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];return{allies:ensureValidationTargets('味方',3),enemies:ensureValidationTargets('敵',2)}};
 add('FORMAL-SHIELD-SINGLE-ABSORB','Studio正式単体シールドと吸収',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],skill=requireSkill('SKL-TEST-SHIELD-100'),caseErrors=[];const grant=executeTaggedSkill(actor,target,skill),damage=applyTaggedAttack(f.enemies[0],target,{id:'FORMAL-DAMAGE-60',name:'正式回帰ダメージ60'},{parameters:{damageType:'fixed',damage:60}}),final=formalShieldSnapshot(target);if(!grant.ok)caseErrors.push('付与に失敗しました');if(damage.damage!==0||damage.shieldAbsorbed!==60)caseErrors.push(`吸収結果が不正です: damage=${damage.damage}, absorbed=${damage.shieldAbsorbed}`);if(final.shield_total!==40)caseErrors.push(`残量が40ではありません: ${final.shield_total}`);return{skill_id:skill.id,source:skill.source,final_state:final,result:{grant_ok:grant.ok,damage},errors:caseErrors}});
 add('FORMAL-SHIELD-ALL','Studio正式全体シールド',()=>{const f=prepare(),actor=f.allies[0],skill=requireSkill('SKL-TEST-SHIELD-ALL-60'),caseErrors=[],result=executeTaggedSkill(actor,f.allies[1],skill),states=f.allies.map(formalShieldSnapshot);if(!result.ok)caseErrors.push('全体付与に失敗しました');if(states.some(x=>x.shield_total!==60))caseErrors.push(`味方全員が60ではありません: ${states.map(x=>x.shield_total).join(',')}`);if(f.enemies.some(x=>shieldTotal(x)!==0))caseErrors.push('敵へシールドが付与されました');return{skill_id:skill.id,source:skill.source,final_states:states,result:{ok:result.ok,targets:result.targets||[]},errors:caseErrors}});
 add('FORMAL-SHIELD-FIFO','Studio正式複数シールドFIFO',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],large=requireSkill('SKL-TEST-SHIELD-100'),small=requireSkill('SKL-TEST-SHIELD-40'),caseErrors=[];executeTaggedSkill(actor,target,large);executeTaggedSkill(actor,target,small);const damage=applyTaggedAttack(f.enemies[0],target,{id:'FORMAL-DAMAGE-120',name:'正式回帰ダメージ120'},{parameters:{damageType:'fixed',damage:120}}),final=formalShieldSnapshot(target);if(damage.damage!==0||damage.shieldAbsorbed!==120)caseErrors.push('FIFO吸収量が不正です');if(final.shield_total!==20||final.shield_effects.length!==1||final.shield_effects[0].skill_id!==small.id)caseErrors.push('古いシールドから消費されていません');return{skill_ids:[large.id,small.id],final_state:final,result:damage,errors:caseErrors}});
 add('FORMAL-SHIELD-DURATION','Studio正式シールド期限',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],skill=requireSkill('SKL-TEST-SHIELD-100'),caseErrors=[];executeTaggedSkill(actor,target,skill);processTicks(500);const final=formalShieldSnapshot(target);if(final.shield_total!==0)caseErrors.push(`Tick500で消えていません: ${final.shield_total}`);return{skill_id:skill.id,tick:battle.tick,final_state:final,errors:caseErrors}});
 add('FORMAL-SHIELD-BATTLE-END','Studio正式シールド戦闘終了消去',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],skill=requireSkill('SKL-TEST-SHIELD-100'),caseErrors=[];executeTaggedSkill(actor,target,skill);for(const enemy of f.enemies){enemy.hp=0;enemy.alive=false}finishIfNeeded();const final=formalShieldSnapshot(target);if(final.shield_total!==0)caseErrors.push('戦闘終了後に残っています');return{skill_id:skill.id,pending_result:battle.pendingResult,final_state:final,errors:caseErrors}});
 return{cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
}
function buildFormalRuntimeRegressionReport(){
 const required=['SKL-TEST-ATTACK','SKL-TEST-POISON','SKL-TEST-BUFF-10','SKL-TEST-DEBUFF-10','SKL-TEST-FOLLOW-POISON','SKL-TEST-HEAL-100','SKL-TEST-HEAL-ALL-60','SKL-TEST-SHIELD-100','SKL-TEST-SHIELD-ALL-60','SKL-TEST-SHIELD-40'];
 const imported=TAG_SKILLS.filter(x=>x.source==='studio_export');
 const production=imported.filter(x=>(x.environment||'production')==='production');
 const validation=imported.filter(x=>(x.environment||'production')==='validation');
 const compileRow=skill=>{const compiled=compileTaggedSkill(skill);return{id:skill.id,name:skill.name,source:skill.source,environment:skill.environment||'production',compiled_ok:!!compiled.ok,logic_order:compiled.definition?.logicOrder||[],errors:compiled.errors||[]}};
 const production_results=production.map(compileRow);
 const validation_results=validation.map(skill=>{const row=compileRow(skill);return{...row,expected_result:'rejected',validation_passed:!row.compiled_ok&&row.errors.length>0}});
 const required_results=required.map(id=>{const skill=findTagSkill(id);return{id,found:!!skill,source:skill?.source||null,environment:skill?.environment||null,compiled_ok:!!(skill&&compileTaggedSkill(skill).ok)} });
 const production_embedded=TAG_SKILLS.filter(x=>x.source!=='studio_export' && (x.environment||'production')==='production').map(x=>x.id);
 const shield_runtime=runFormalShieldRuntimeRegression();
 const errors=[];
 if(studioSkillBridge.status!=='loaded')errors.push(`Studio出力未読込: ${studioSkillBridge.status}`);
 if(!studioSkillBridge.data_version)errors.push('data_versionがありません');
 for(const row of required_results){if(!row.found)errors.push(`${row.id}がありません`);else if(row.source!=='studio_export')errors.push(`${row.id}が固定定義です`);else if(row.environment!=='production')errors.push(`${row.id}がproductionではありません`);else if(!row.compiled_ok)errors.push(`${row.id}のコンパイルに失敗しました`)}
 for(const row of production_results){if(!row.compiled_ok)errors.push(`${row.id}: ${row.errors.join(', ')}`)}
 for(const row of validation_results){if(!row.validation_passed)errors.push(`${row.id}: validation定義が期待どおり拒否されませんでした`)}
 if(production_embedded.length)errors.push(`正式運用対象に固定定義が残っています: ${production_embedded.join(', ')}`);
 errors.push(...shield_runtime.summary.errors);
 return{schema_version:'1.2.0',build:'GA-B486.3',generated_at:new Date().toISOString(),test:{id:'TAG-FORMAL-RUNTIME-REGRESSION-001',mode:'formal_runtime_environment_separation_and_shield_execution',entrypoint:'game/index.html'},source:{status:studioSkillBridge.status,url:studioSkillBridge.source_url,data_version:studioSkillBridge.data_version,generated_by:studioSkillBridge.generated_by,imported_count:imported.length},required_results,production_results,validation_results,shield_runtime,dependency_audit:{production_embedded_ids:production_embedded,studio_production_ids:production.map(x=>x.id),studio_validation_ids:validation.map(x=>x.id)},summary:{required_count:required.length,required_studio_sourced:required_results.filter(x=>x.source==='studio_export'&&x.environment==='production').length,production_compile_count:production_results.filter(x=>x.compiled_ok).length,production_definition_count:production_results.length,validation_expected_rejection_count:validation_results.filter(x=>x.validation_passed).length,validation_definition_count:validation_results.length,production_embedded_count:production_embedded.length,shield_runtime_passed_count:shield_runtime.summary.passed_count,shield_runtime_case_count:shield_runtime.summary.case_count,passed:errors.length===0,errors}};
}
function downloadFormalRuntimeRegressionJson(){const report=buildFormalRuntimeRegressionReport(),blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-formal-runtime-regression-GA-B486.3-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);return report}
