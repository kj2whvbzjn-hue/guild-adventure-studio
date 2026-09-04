/* Studio skill data bridge — GA-B486.213 / GKS-B647 / Formal Skill */
const STUDIO_SKILL_EXPORT_URL=window.GA_PROJECT_CONFIG.skillExportUrl;
let studioSkillFormalRegistry=null;
const studioSkillBridge={status:'idle',source_url:STUDIO_SKILL_EXPORT_URL,schema_version:null,data_version:null,generated_by:null,imported_ids:[],errors:[],loaded_at:null};
function normalizeStudioSkill(record){
 if(!record||typeof record!=='object'||!record.id||!record.name)return null;
 const environment=String(record.environment||'production').toLowerCase();
 if(record.runtimeContracts&&record.schemaVersion===1){
  return{...record,id:String(record.id),name:String(record.name),source:'studio_export',environment,definition_format:'formal_skill_v1'};
 }
 const tags=Array.isArray(record.tags)?record.tags.map(x=>String(x).trim()).filter(Boolean):[];
 if(environment==='production'||!tags.length)return null;
 return{id:String(record.id),name:String(record.name),tags,source:'studio_export',environment,definition_format:record.definition_format||'tag_v1',expected_result:record.expected_result||null};
}
async function loadStudioSkillDefinitions(){
 studioSkillBridge.status='loading';studioSkillBridge.errors=[];
 try{
  const response=await fetch(STUDIO_SKILL_EXPORT_URL,{cache:'no-store'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const payload=await response.json(),rows=Array.isArray(payload)?payload:(Array.isArray(payload?.data)?payload.data:[]);
  if(globalThis.GKSSkillCompileService?.loadRegistry)studioSkillFormalRegistry=await globalThis.GKSSkillCompileService.loadRegistry();
  const imported=rows.map(normalizeStudioSkill).filter(Boolean);
  if(!imported.length)throw new Error('Skill定義が0件です');
  for(const skill of imported){const i=SKILLS.findIndex(x=>x.id===skill.id);if(i>=0)SKILLS.splice(i,1,skill);else SKILLS.push(skill)}
  studioSkillBridge.status='loaded';studioSkillBridge.schema_version=payload?.schema_version||null;studioSkillBridge.data_version=payload?.data_version||null;studioSkillBridge.generated_by=payload?.generated_by||null;studioSkillBridge.imported_ids=imported.map(x=>x.id);studioSkillBridge.loaded_at=new Date().toISOString();
  if(typeof populateTagSkillTestUI==='function')populateTagSkillTestUI();
  if(typeof renderCharacterSkillView==='function')renderCharacterSkillView();
  return studioSkillBridge;
 }catch(error){studioSkillBridge.status='failed';studioSkillBridge.errors=[String(error?.message||error)];return studioSkillBridge}
}
function buildStudioBridgeValidationReport(){
 const required=['SKL-TEST-ATTACK','SKL-TEST-POISON','SKL-TEST-BUFF-10','SKL-TEST-DEBUFF-10','SKL-TEST-FOLLOW-POISON','SKL-TEST-HEAL-100','SKL-TEST-HEAL-ALL-60','SKL-TEST-SHIELD-100','SKL-TEST-SHIELD-ALL-60'];
 const compile_results=required.map(id=>{const skill=findSkill(id),compiled=skill?compileSkillForRuntime(skill):null;return{id,found:!!skill,source:skill?.source||'embedded',tags:skill?.tags||[],compiled_ok:!!compiled?.ok,logic_order:compiled?.definition?.logicOrder||[],errors:compiled?.errors||['skill not found']}});
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
 const requireSkill=id=>{const skill=findSkill(id);if(!skill)throw new Error(`${id}がありません`);if(skill.source!=='studio_export'||(skill.environment||'production')!=='production')throw new Error(`${id}がStudio production由来ではありません`);return skill};
 const prepare=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];return{allies:ensureValidationTargets('味方',3),enemies:ensureValidationTargets('敵',2)}};
 add('FORMAL-SHIELD-SINGLE-ABSORB','Studio正式単体シールドと吸収',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],skill=requireSkill('SKL-TEST-SHIELD-100'),caseErrors=[];const attackSkill=requireSkill('SKL-TEST-ATTACK'),attacker=f.enemies[0];attacker.attack=60;const grant=executeSkillRuntime(actor,target,skill),attackExecution=executeSkillRuntime(attacker,target,attackSkill),damage=attackExecution.attackResult,final=formalShieldSnapshot(target);if(!grant.ok)caseErrors.push('付与に失敗しました');if(damage.damage!==0||damage.shieldAbsorbed!==60)caseErrors.push(`吸収結果が不正です: damage=${damage.damage}, absorbed=${damage.shieldAbsorbed}`);if(final.shield_total!==40)caseErrors.push(`残量が40ではありません: ${final.shield_total}`);return{skill_id:skill.id,source:skill.source,final_state:final,result:{grant_ok:grant.ok,damage},errors:caseErrors}});
 add('FORMAL-SHIELD-ALL','Studio正式全体シールド',()=>{const f=prepare(),actor=f.allies[0],skill=requireSkill('SKL-TEST-SHIELD-ALL-60'),caseErrors=[],result=executeSkillRuntime(actor,f.allies[1],skill),states=f.allies.map(formalShieldSnapshot);if(!result.ok)caseErrors.push('全体付与に失敗しました');if(states.some(x=>x.shield_total!==60))caseErrors.push(`味方全員が60ではありません: ${states.map(x=>x.shield_total).join(',')}`);if(f.enemies.some(x=>shieldTotal(x)!==0))caseErrors.push('敵へシールドが付与されました');return{skill_id:skill.id,source:skill.source,final_states:states,result:{ok:result.ok,targets:result.targets||[]},errors:caseErrors}});
 add('FORMAL-SHIELD-FIFO','Studio正式複数シールドFIFO',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],large=requireSkill('SKL-TEST-SHIELD-100'),small=requireSkill('SKL-TEST-SHIELD-40'),caseErrors=[];executeSkillRuntime(actor,target,large);executeSkillRuntime(actor,target,small);const attackSkill=requireSkill('SKL-TEST-ATTACK'),attacker=f.enemies[0];attacker.attack=120;const attackExecution=executeSkillRuntime(attacker,target,attackSkill),damage=attackExecution.attackResult,final=formalShieldSnapshot(target);if(damage.damage!==0||damage.shieldAbsorbed!==120)caseErrors.push('FIFO吸収量が不正です');if(final.shield_total!==20||final.shield_effects.length!==1||final.shield_effects[0].skill_id!==small.id)caseErrors.push('古いシールドから消費されていません');return{skill_ids:[large.id,small.id],final_state:final,result:damage,errors:caseErrors}});
 add('FORMAL-SHIELD-DURATION','Studio正式シールド期限',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],skill=requireSkill('SKL-TEST-SHIELD-100'),caseErrors=[];executeSkillRuntime(actor,target,skill);processTicks(500);const final=formalShieldSnapshot(target);if(final.shield_total!==0)caseErrors.push(`Tick500で消えていません: ${final.shield_total}`);return{skill_id:skill.id,tick:battle.tick,final_state:final,errors:caseErrors}});
 add('FORMAL-SHIELD-BATTLE-END','Studio正式シールド戦闘終了消去',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],skill=requireSkill('SKL-TEST-SHIELD-100'),caseErrors=[];executeSkillRuntime(actor,target,skill);for(const enemy of battle.units.filter(unit=>unit.side==='敵')){enemy.hp=0;enemy.alive=false}finishIfNeeded();const final=formalShieldSnapshot(target);if(final.shield_total!==0)caseErrors.push('戦闘終了後に残っています');return{skill_id:skill.id,pending_result:battle.pendingResult,final_state:final,errors:caseErrors}});
 return{cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
}
function formalStatusSnapshot(unit){return{id:unit?.id||null,hp:unit?.hp??null,max_hp:unit?.maxHp??null,alive:!!unit?.alive,status_resistance:unit?.statusResistance||{},status_effects:typeof ensureStatusEffects==='function'?ensureStatusEffects(unit).map(x=>({instance_id:x.instanceId,status_id:x.statusId,skill_id:x.skillId,applied_tick:x.appliedTick,base_duration_tick:x.baseDurationTick,effective_duration_tick:x.effectiveDurationTick,expires_tick:x.expiresTick,target_resistance:x.targetResistance,stack_policy:x.stackPolicy,payload:x.payload})):[]}}
function runFormalStatusRuntimeRegression(){
 const cases=[],errors=[];
 const add=(id,label,fn)=>{try{const result=fn(),row={id,label,...result};row.passed=(row.errors||[]).length===0;cases.push(row);if(!row.passed)errors.push(...row.errors.map(x=>`${id}: ${x}`))}catch(error){const message=String(error?.message||error);cases.push({id,label,passed:false,errors:[message]});errors.push(`${id}: ${message}`)}};
 const requireSkill=id=>{const skill=findSkill(id);if(!skill)throw new Error(`${id}がありません`);if(skill.source!=='studio_export'||(skill.environment||'production')!=='production')throw new Error(`${id}がStudio production由来ではありません`);return skill};
 const prepare=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];return{allies:ensureValidationTargets('味方',3),enemies:ensureValidationTargets('敵',2)}};
 add('FORMAL-STATUS-APPLY','Studio正式状態異常付与',()=>{const f=prepare(),actor=f.allies[0],target=f.enemies[0],skill=requireSkill('SKL-TEST-STATUS-ACCURACY-DOWN'),caseErrors=[],result=executeSkillRuntime(actor,target,skill),final=formalStatusSnapshot(target),effect=target.statusEffects?.[0];if(!result.ok)caseErrors.push('付与実行に失敗しました');if(!effect)caseErrors.push('状態異常が付与されていません');if(effect&&effect.effectiveDurationTick!==400)caseErrors.push(`持続時間が400ではありません: ${effect.effectiveDurationTick}`);return{skill_id:skill.id,source:skill.source,final_state:final,result:{ok:result.ok,targets:result.targets||[]},errors:caseErrors}});
 add('FORMAL-STATUS-RESIST-DURATION','Studio正式耐性による持続短縮',()=>{const f=prepare(),actor=f.allies[0],target=f.enemies[0],skill=requireSkill('SKL-TEST-STATUS-ACCURACY-DOWN'),caseErrors=[];target.statusResistance={'STATUS-ACCURACY-DOWN':25};executeSkillRuntime(actor,target,skill);const effect=target.statusEffects?.[0],final=formalStatusSnapshot(target);if(!effect)caseErrors.push('状態異常が付与されていません');if(effect&&(effect.targetResistance!==25||effect.effectiveDurationTick!==300||effect.expiresTick!==300))caseErrors.push(`耐性短縮が不正です: resistance=${effect.targetResistance}, duration=${effect.effectiveDurationTick}, expires=${effect.expiresTick}`);return{skill_id:skill.id,final_state:final,errors:caseErrors}});
 add('FORMAL-STATUS-ATTACK-HIT','Studio正式攻撃命中後の状態異常付与',()=>{const f=prepare(),actor=f.allies[0],target=f.enemies[0],skill=requireSkill('SKL-TEST-ATTACK-STATUS-ACCURACY-DOWN'),caseErrors=[];actor.attack=60;const before=target.hp,result=executeSkillRuntime(actor,target,skill),effect=target.statusEffects?.[0],final=formalStatusSnapshot(target);if(!result.attackResult?.ok)caseErrors.push('ATTACKが成立していません');if(!(target.hp<before))caseErrors.push('攻撃ダメージが適用されていません');if(!effect)caseErrors.push('攻撃成立後に状態異常が付与されていません');return{skill_id:skill.id,source:skill.source,hp_before:before,final_state:final,result:{ok:result.ok,attack_result:result.attackResult},errors:caseErrors}});
 add('FORMAL-STATUS-REFRESH-EXPIRE','Studio正式再付与と満了',()=>{const f=prepare(),actor=f.allies[0],target=f.enemies[0],skill=requireSkill('SKL-TEST-STATUS-ACCURACY-DOWN'),caseErrors=[];target.statusResistance={'STATUS-ACCURACY-DOWN':25};executeSkillRuntime(actor,target,skill);battle.tick=100;executeSkillRuntime(actor,target,skill);const refreshed=target.statusEffects?.[0];if(target.statusEffects?.length!==1)caseErrors.push(`refresh後の件数が1ではありません: ${target.statusEffects?.length}`);if(refreshed?.expiresTick!==400)caseErrors.push(`refresh後の期限が400ではありません: ${refreshed?.expiresTick}`);battle.tick=400;processStatusEffects();if(target.statusEffects?.length)caseErrors.push('Tick400で満了していません');const hasRefresh=battle.validationEvents.some(x=>x.type==='status_refreshed'),hasExpire=battle.validationEvents.some(x=>x.type==='status_removed'&&x.reason==='expired');if(!hasRefresh)caseErrors.push('status_refreshedログがありません');if(!hasExpire)caseErrors.push('expiredログがありません');return{skill_id:skill.id,tick:battle.tick,final_state:formalStatusSnapshot(target),events:[...battle.validationEvents],errors:caseErrors}});
 add('FORMAL-STATUS-BATTLE-END','Studio正式状態異常の戦闘終了消去',()=>{const f=prepare(),actor=f.allies[0],target=f.enemies[0],skill=requireSkill('SKL-TEST-STATUS-ACCURACY-DOWN'),caseErrors=[];executeSkillRuntime(actor,target,skill);for(const enemy of battle.units.filter(unit=>unit.side==='敵')){enemy.hp=0;enemy.alive=false}finishIfNeeded();const final=formalStatusSnapshot(target);if(final.status_effects.length)caseErrors.push('戦闘終了後に状態異常が残っています');return{skill_id:skill.id,pending_result:battle.pendingResult,final_state:final,errors:caseErrors}});
 return{cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
}
function formalCleanseSnapshot(unit){return{id:unit?.id||null,hp:unit?.hp??null,max_hp:unit?.maxHp??null,alive:!!unit?.alive,status_effects:typeof ensureStatusEffects==='function'?ensureStatusEffects(unit).map(x=>({instance_id:x.instanceId,status_id:x.statusId,applied_tick:x.appliedTick,expires_tick:x.expiresTick,protected:!!x.protected,removable:x.removable!==false})):[]}}
function runFormalCleanseRuntimeRegression(){
 const cases=[],errors=[];
 const add=(id,label,fn)=>{try{const result=fn(),row={id,label,...result};row.passed=(row.errors||[]).length===0;cases.push(row);if(!row.passed)errors.push(...row.errors.map(x=>`${id}: ${x}`))}catch(error){const message=String(error?.message||error);cases.push({id,label,passed:false,errors:[message]});errors.push(`${id}: ${message}`)}};
 const requireSkill=id=>{const skill=findSkill(id);if(!skill)throw new Error(`${id}がありません`);if(skill.source!=='studio_export'||(skill.environment||'production')!=='production')throw new Error(`${id}がStudio production由来ではありません`);return skill};
 const prepare=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];return{allies:ensureValidationTargets('味方',3),enemies:ensureValidationTargets('敵',2)}};
 const apply=(actor,target,id,tick=0)=>{battle.tick=tick;return applyTaggedStatus(actor,target,{definition:{id:`FORMAL-${id}`,parameters:{statusId:id,statusDuration:400,statusStackPolicy:'refresh',statusPayload:{}}}})};
 add('FORMAL-CLEANSE-SINGLE-OLDEST','Studio正式単体・最古1件解除',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],skill=requireSkill('SKL-TEST-CLEANSE-1'),caseErrors=[];apply(actor,target,'STATUS-FORMAL-A',0);apply(actor,target,'STATUS-FORMAL-B',10);const result=executeSkillRuntime(actor,target,skill),ids=target.statusEffects.map(x=>x.statusId);if(!result.cleanseResult?.ok||result.cleanseResult.removedCount!==1)caseErrors.push('1件解除に失敗しました');if(ids.includes('STATUS-FORMAL-A')||!ids.includes('STATUS-FORMAL-B'))caseErrors.push(`最古順解除が不正です: ${ids.join(',')}`);return{skill_id:skill.id,source:skill.source,final_state:formalCleanseSnapshot(target),result:result.cleanseResult,events:[...battle.validationEvents],errors:caseErrors}});
 add('FORMAL-CLEANSE-ALL','Studio正式単体全解除',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],skill=requireSkill('SKL-TEST-CLEANSE-ALL'),caseErrors=[];apply(actor,target,'STATUS-FORMAL-A',0);apply(actor,target,'STATUS-FORMAL-B',1);const result=executeSkillRuntime(actor,target,skill);if(result.cleanseResult?.removedCount!==2||target.statusEffects.length)caseErrors.push('単体全解除に失敗しました');return{skill_id:skill.id,source:skill.source,final_state:formalCleanseSnapshot(target),result:result.cleanseResult,events:[...battle.validationEvents],errors:caseErrors}});
 add('FORMAL-CLEANSE-ALL-PARTY','Studio正式味方全体解除',()=>{const f=prepare(),actor=f.allies[0],skill=requireSkill('SKL-TEST-CLEANSE-ALL-PARTY'),caseErrors=[];for(const unit of f.allies)apply(actor,unit,`STATUS-${unit.id}`,0);const result=executeSkillRuntime(actor,actor,skill),states=f.allies.map(formalCleanseSnapshot);if(f.allies.some(x=>x.statusEffects.length))caseErrors.push('味方全体解除に失敗しました');return{skill_id:skill.id,source:skill.source,final_states:states,result:{ok:result.ok,targets:result.targets||[],target_results:(result.targetResults||[]).map(x=>({target_id:x.targetId,removed_count:x.cleanseResult?.removedCount??null}))},events:[...battle.validationEvents],errors:caseErrors}});
 add('FORMAL-CLEANSE-PROTECTED','Studio正式保護状態スキップ',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],skill=requireSkill('SKL-TEST-CLEANSE-ALL'),caseErrors=[];apply(actor,target,'STATUS-FORMAL-PROTECTED',0);target.statusEffects[0].protected=true;const result=executeSkillRuntime(actor,target,skill);if(result.cleanseResult?.removedCount!==0||result.cleanseResult?.skippedProtectedCount!==1||target.statusEffects.length!==1)caseErrors.push('保護状態のスキップが不正です');return{skill_id:skill.id,source:skill.source,final_state:formalCleanseSnapshot(target),result:result.cleanseResult,events:[...battle.validationEvents],errors:caseErrors}});
 add('FORMAL-CLEANSE-NONE','Studio正式対象効果なし正常終了',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],skill=requireSkill('SKL-TEST-CLEANSE-1'),caseErrors=[],result=executeSkillRuntime(actor,target,skill);if(!result.ok||!result.cleanseResult?.ok||result.cleanseResult.removedCount!==0)caseErrors.push('対象効果なしが正常終了ではありません');return{skill_id:skill.id,source:skill.source,final_state:formalCleanseSnapshot(target),result:result.cleanseResult,events:[...battle.validationEvents],errors:caseErrors}});
 return{cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
}

function formalReviveSnapshot(unit){return{id:unit?.id||null,hp:unit?.hp??null,max_hp:unit?.maxHp??null,alive:!!unit?.alive,gauge:unit?.gauge??null,reserved_action:unit?.reservedAction||null,status_count:Array.isArray(unit?.statusEffects)?unit.statusEffects.length:0,dot_count:Array.isArray(unit?.dotStacks)?unit.dotStacks.length:0,modifier_count:Array.isArray(unit?.modifierStacks)?unit.modifierStacks.length:0,shield_count:Array.isArray(unit?.shieldEffects)?unit.shieldEffects.length:0}}
function runFormalReviveRuntimeRegression(){
 const cases=[],errors=[];
 const add=(id,label,fn)=>{try{const result=fn(),row={id,label,...result};row.passed=(row.errors||[]).length===0;cases.push(row);if(!row.passed)errors.push(...row.errors.map(x=>`${id}: ${x}`))}catch(error){const message=String(error?.message||error);cases.push({id,label,passed:false,errors:[message]});errors.push(`${id}: ${message}`)}};
 const requireSkill=id=>{const skill=findSkill(id);if(!skill)throw new Error(`${id}がありません`);if(skill.source!=='studio_export'||(skill.environment||'production')!=='production')throw new Error(`${id}がStudio production由来ではありません`);return skill};
 const prepare=()=>{pauseBattle();resetBattle();battle.validationMode=true;battle.validationEvents=[];return{allies:ensureValidationTargets('味方',3),enemies:ensureValidationTargets('敵',2)}};
 const kill=unit=>{unit.statusEffects=[{instanceId:'FORMAL-STATUS'}];unit.dotStacks=[{id:'FORMAL-DOT'}];unit.modifierStacks=[{id:'FORMAL-MOD'}];unit.shieldEffects=[{id:'FORMAL-SHIELD',remaining:50}];unit.gauge=88;unit.reservedAction={skillId:'FORMAL'};return resetCombatantOnDeath(unit,{reason:'formal_revive_fixture'})};
 add('FORMAL-REVIVE-SINGLE-FIXED','Studio正式単体固定HP蘇生',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],skill=requireSkill('SKL-REVIVE-SINGLE-100'),caseErrors=[];kill(target);const result=executeSkillRuntime(actor,target,skill),final=formalReviveSnapshot(target);if(!result.ok||!result.reviveResult?.ok)caseErrors.push('単体蘇生に失敗しました');if(final.hp!==100||!final.alive||final.gauge!==0)caseErrors.push(`復帰状態が不正です: hp=${final.hp}, alive=${final.alive}, gauge=${final.gauge}`);return{skill_id:skill.id,source:skill.source,final_state:final,result:result.reviveResult,events:[...battle.validationEvents],errors:caseErrors}});
 add('FORMAL-REVIVE-HP-CAP','Studio正式蘇生HP上限',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],skill=requireSkill('SKL-REVIVE-SINGLE-100'),caseErrors=[];target.maxHp=80;kill(target);const result=executeSkillRuntime(actor,target,skill),final=formalReviveSnapshot(target);if(final.hp!==80)caseErrors.push(`最大HP上限が不正です: ${final.hp}`);return{skill_id:skill.id,final_state:final,result:result.reviveResult,errors:caseErrors}});
 add('FORMAL-REVIVE-LIVING-REJECT','Studio正式生存対象拒否',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],skill=requireSkill('SKL-REVIVE-SINGLE-100'),caseErrors=[],before=formalReviveSnapshot(target),result=executeSkillRuntime(actor,target,skill),after=formalReviveSnapshot(target);if(result.ok||result.stage!=='target'||!String(result.reason||'').includes('INVALID_TARGET'))caseErrors.push('生存対象がINVALID_TARGETになりません');if(before.hp!==after.hp||before.alive!==after.alive)caseErrors.push('生存対象が変更されました');return{skill_id:skill.id,before_state:before,final_state:after,result:{ok:result.ok,stage:result.stage,reason:result.reason},errors:caseErrors}});
 add('FORMAL-REVIVE-ALL','Studio正式味方全体蘇生',()=>{const f=prepare(),actor=f.allies[0],skill=requireSkill('SKL-REVIVE-ALL-60'),caseErrors=[];kill(f.allies[1]);kill(f.allies[2]);const result=executeSkillRuntime(actor,actor,skill),states=f.allies.map(formalReviveSnapshot);if(states[1].hp!==60||states[2].hp!==60||!states[1].alive||!states[2].alive)caseErrors.push('死亡者全員を60HPで蘇生できません');if((result.targets||[]).length!==2)caseErrors.push(`対象数が2ではありません: ${(result.targets||[]).length}`);return{skill_id:skill.id,source:skill.source,final_states:states,result:{ok:result.ok,targets:result.targets||[],target_results:(result.targetResults||[]).map(x=>({target_id:x.targetId,hp_after:x.reviveResult?.hpAfter??null}))},events:[...battle.validationEvents],errors:caseErrors}});
 add('FORMAL-REVIVE-DEATH-RESET','Studio正式死亡リセット後蘇生',()=>{const f=prepare(),actor=f.allies[0],target=f.allies[1],skill=requireSkill('SKL-REVIVE-SINGLE-100'),caseErrors=[],reset=kill(target),result=executeSkillRuntime(actor,target,skill),final=formalReviveSnapshot(target);if(final.status_count||final.dot_count||final.modifier_count||final.shield_count||final.reserved_action||final.gauge!==0)caseErrors.push('死亡前の一時状態が残っています');return{skill_id:skill.id,reset_result:reset,final_state:final,result:result.reviveResult,events:[...battle.validationEvents],errors:caseErrors}});
 return{cases,summary:{case_count:cases.length,passed_count:cases.filter(x=>x.passed).length,failed_count:cases.filter(x=>!x.passed).length,passed:errors.length===0,errors}};
}
const R06_FINAL_MASTER_SKILL_ID_RE=/^SKL-\d{4}$/;
const R06_FINAL_MASTER_SKILL_NAME_RE=/^R06大量複合検査 V(0[1-9]|[1-3]\d|4[0-8])(?:\s|$)/;
const STUDIO_CURRENT_PROJECT_STORAGE_KEY='gas_v4_current_project_v060';
const STUDIO_PROJECT_STORAGE_PREFIX='gas_v4_project_v060_';
function loadCurrentStudioMasterForRuntimeRegression(){
 try{
  const id=String(localStorage.getItem(STUDIO_CURRENT_PROJECT_STORAGE_KEY)||'').trim();
  if(!id)return{ok:false,project_id:null,skills:[],error:'Studio current project IDがありません'};
  const raw=localStorage.getItem(STUDIO_PROJECT_STORAGE_PREFIX+id);if(!raw)return{ok:false,project_id:id,skills:[],error:'Studio current project dataがありません'};
  const project=JSON.parse(raw),skills=Array.isArray(project?.masters?.skills)?project.masters.skills:[];
  return{ok:true,project_id:id,skills,project,error:null};
 }catch(e){return{ok:false,project_id:null,skills:[],error:String(e?.message||e)}}
}
function isR06FinalMasterSkill(skill){
 return R06_FINAL_MASTER_SKILL_ID_RE.test(String(skill?.id||''))&&R06_FINAL_MASTER_SKILL_NAME_RE.test(String(skill?.name||''));
}
function r06FinalMasterSkillOrdinal(skill){const m=String(skill?.name||'').match(R06_FINAL_MASTER_SKILL_NAME_RE);return m?Number(m[1]):Number.MAX_SAFE_INTEGER}
function r06MasterSkillShape(skill){
 return{top_level_keys:Object.keys(skill||{}).sort(),has_runtimeContracts:!!skill?.runtimeContracts,schemaVersion:skill?.schemaVersion??null,legacy_tags:Array.isArray(skill?.tags)&&skill.tags.length>0};
}
function compileStudioMasterSkillForRuntime(skill){
 const shape=r06MasterSkillShape(skill);
 if(!skill||typeof skill!=='object'||Array.isArray(skill))return{ok:false,skill:null,authored:null,source:null,input_source:null,input_shape:shape,errors:['正式Skill Master objectではありません']};
 if(skill.schemaVersion!==1||!skill.runtimeContracts){
  const legacy=shape.legacy_tags||skill?.params!=null;
  return{ok:false,skill:null,authored:null,source:null,input_source:'master',input_shape:shape,errors:[legacy?'旧形式Skill Masterです。新Formal登録経路で再登録が必要です':'正式Skill MasterにruntimeContractsがありません']};
 }
 return{ok:true,skill:{...skill,source:'studio_master_localstorage',environment:'production'},authored:null,source:'runtimeContracts',input_source:'master.runtimeContracts',input_shape:shape};
}

// Developer-only E2E bridge. Keeps Studio Master skills outside the production SKILLS store.
const developerE2ESkillStore=new Map();
function listR06MasterSkillsForGameE2E(){
 const source=loadCurrentStudioMasterForRuntimeRegression();
 if(!source.ok)return{ok:false,project_id:source.project_id,skills:[],errors:[source.error||'Studio Masterを取得できません']};
 const rows=source.skills.filter(isR06FinalMasterSkill).sort((a,b)=>r06FinalMasterSkillOrdinal(a)-r06FinalMasterSkillOrdinal(b)||String(a.id).localeCompare(String(b.id)));
 const skills=[],errors=[];
 for(const row of rows){
  const prepared=compileStudioMasterSkillForRuntime(row),compiled=prepared.ok?compileSkillRuntime(prepared.skill):null;
  if(!prepared.ok||!compiled?.ok){errors.push(`${row?.id||'(unknown)'}: ${[...(prepared.errors||[]),...(compiled?.errors||[])].join(' / ')}`);continue}
  skills.push(prepared.skill);
 }
 return{ok:errors.length===0&&skills.length===48,project_id:source.project_id,skills,errors};
}
function loadR06MasterSkillForGameE2E(skillId){
 const listed=listR06MasterSkillsForGameE2E();
 if(!listed.ok)return{ok:false,skill:null,project_id:listed.project_id,errors:listed.errors};
 const skill=listed.skills.find(x=>x.id===skillId)||null;
 if(!skill)return{ok:false,skill:null,project_id:listed.project_id,errors:[`${skillId}がR06 Master 48件にありません`]};
 const e2eSkill={...skill,source:'studio_master_localstorage',environment:'production',e2e_test_only:true};
 developerE2ESkillStore.set(e2eSkill.id,e2eSkill);
 return{ok:true,skill:e2eSkill,project_id:listed.project_id,errors:[]};
}
function findDeveloperE2ESkill(skillId){return developerE2ESkillStore.get(String(skillId||''))||null}
function clearDeveloperE2ESkills(){developerE2ESkillStore.clear()}
function r06FinalPrepareBattle(){
 pauseBattle();resetBattle();battle.validationMode=true;battle.validationCaptureEvents=true;battle.validationEvents=[];
 const allies=ensureValidationTargets('味方',3),enemies=ensureValidationTargets('敵',3);
 for(const u of [...allies,...enemies]){u.maxHp=1000000;u.hp=500000;u.maxMp=1000000;u.mp=500000;u.alive=true;u.attack=Math.max(100,Number(u.attack)||100);u.statusEffects=[];u.dotStacks=[];u.modifierStacks=[];u.shieldEffects=[];u.coverEffects=[]}
 return{allies,enemies,actor:allies[0]};
}
function r06FinalSeedCleanseTarget(target,skillId){
 const list=ensureStatusEffects(target);list.push({instanceId:`R06-FINAL-SEED-${skillId}`,statusId:'R06-FINAL-SEED-STATUS',sourceId:'R06-FINAL-SEED',skillId:'R06-FINAL-SEED',appliedTick:-10,baseDurationTick:9999,effectiveDurationTick:9999,expiresTick:9999,removable:true,protected:false,sequence:1,payload:{}});
}
function r06FinalEventCount(skillId,type){return (battle.validationEvents||[]).filter(x=>x?.skill_id===skillId&&x?.type===type).length}
function runR06MasterStructuredRuntimeFinalRegression(){
 const source=loadCurrentStudioMasterForRuntimeRegression(),cases=[],errors=[];
 if(!source.ok)return{schema_version:'1.0.0',build:'GA-B486.213',generated_at:new Date().toISOString(),test:{id:'R06-MASTER-STRUCTURED-RUNTIME-FINAL-001',mode:'master_registered_structured_skill_composite_runtime_final'},source,compile_results:[],cases:[],summary:{master_skill_count:0,compile_passed_count:0,runtime_passed_count:0,runtime_case_count:0,composite_case_count:0,passed:false,errors:[source.error||'Studio Masterを取得できません']}};
 const rows=source.skills.filter(isR06FinalMasterSkill).sort((a,b)=>r06FinalMasterSkillOrdinal(a)-r06FinalMasterSkillOrdinal(b)||String(a.id).localeCompare(String(b.id)));
 const compile_results=rows.map(skill=>{const prepared=compileStudioMasterSkillForRuntime(skill),compiled=prepared.ok?compileSkillRuntime(prepared.skill):null,runtime=compiled?.definition?.runtimeContracts||null,runtimeContractSource=runtime?(prepared.source==='formal_compiler'?'formal_compiler->runtimeContracts':'runtimeContracts'):null,er=[];if(!prepared.ok)er.push(...(prepared.errors||['formal compile failed']));else if(!compiled?.ok)er.push(...(compiled?.errors||['compile failed']));if(!runtime)er.push('runtimeContractsがRuntime compilerへ接続されていません');return{id:skill.id,name:skill.name,input_source:prepared.input_source||null,input_shape:prepared.input_shape||r06MasterSkillShape(skill),compiled_ok:!!compiled?.ok,runtime_contract_connected:!!runtime,runtime_contract_source:runtimeContractSource,logic_order:compiled?.definition?.logicOrder||[],effect_types:(runtime?.effectContracts||[]).map(x=>x.type),apply_logics:(runtime?.applyContracts||[]).map(x=>x.logic),errors:er}});
 for(const row of compile_results)if(row.errors.length)errors.push(`${row.id}: ${row.errors.join(' / ')}`);
 for(const skill of rows){
  const prepared=compileStudioMasterSkillForRuntime(skill),runtimeSkill=prepared.skill,compiled=prepared.ok?compileSkillRuntime(runtimeSkill):null,runtime=compiled?.definition?.runtimeContracts||null,runtimeContractSource=runtime?(prepared.source==='formal_compiler'?'formal_compiler->runtimeContracts':'runtimeContracts'):null,caseErrors=[];
  if(!prepared.ok||!compiled?.ok||!runtime){cases.push({id:skill.id,name:skill.name,input_source:prepared.input_source||null,input_shape:prepared.input_shape||r06MasterSkillShape(skill),runtime_contract_source:runtimeContractSource,passed:false,errors:[...(prepared.errors||[]),'compile/runtimeContracts connection failed']});continue}
  
  try{
   const f=r06FinalPrepareBattle(),side=compiled.definition.target.side,target=side==='enemy'?f.enemies[0]:side==='corpse'?f.allies[1]:f.allies[1];
   if(side==='corpse'){target.hp=0;target.alive=false}
   if((runtime.effectContracts||[]).some(x=>x.type==='REMOVE'))r06FinalSeedCleanseTarget(target,skill.id);
   const before={hp:target.hp,mp:target.mp,status_count:ensureStatusEffects(target).length,shield_total:typeof shieldTotal==='function'?shieldTotal(target):0};
   const result=executeSkillRuntime(f.actor,target,runtimeSkill,{origin:'base',suppressDerived:true}),eventTypes=(battle.validationEvents||[]).filter(x=>x?.skill_id===skill.id).map(x=>x.type);
   if(!result?.ok)caseErrors.push(`execute failed: ${result?.stage||result?.reason||'unknown'}`);
   for(const contract of runtime.effectContracts||[]){
    const eventType={DAMAGE:'skill_damage_executed',HEAL:'skill_heal_executed',REMOVE:'skill_remove_executed',RESOURCE_CHANGE:'skill_resource_change_executed',REVIVE:'skill_revive_executed',TARGET_CONTROL:'skill_target_control_executed'}[contract.type];
    if(eventType&&r06FinalEventCount(skill.id,eventType)<1)caseErrors.push(`${contract.type} runtime event missing`);
   }
   for(const contract of runtime.applyContracts||[])if(r06FinalEventCount(skill.id,'runtime_apply_executed')<1)caseErrors.push(`${contract.logic} APPLY runtime event missing`);
   const effectCount=(runtime.effectContracts||[]).length+(runtime.applyContracts||[]).length+(runtime.auraEffectContract?1:0),composite=effectCount>=2;
   const after={hp:target.hp,mp:target.mp,status_count:ensureStatusEffects(target).length,shield_total:typeof shieldTotal==='function'?shieldTotal(target):0};
   cases.push({id:skill.id,name:skill.name,source:'studio_master_localstorage',project_id:source.project_id,input_source:prepared.input_source||null,input_shape:prepared.input_shape||r06MasterSkillShape(skill),runtime_contract_source:runtimeContractSource,logic_order:compiled.definition.logicOrder,effect_types:(runtime.effectContracts||[]).map(x=>x.type),apply_logics:(runtime.applyContracts||[]).map(x=>x.logic),effect_count:effectCount,composite,before,after,event_types:eventTypes,passed:caseErrors.length===0,errors:caseErrors});
  }catch(e){caseErrors.push(String(e?.message||e));cases.push({id:skill.id,name:skill.name,passed:false,errors:caseErrors})}
 }
 for(const row of cases)if(!row.passed)errors.push(`${row.id}: ${(row.errors||[]).join(' / ')}`);
 if(rows.length!==48)errors.push(`R06最終Master Skill件数が48ではありません: ${rows.length}`);
 const compositeCount=cases.filter(x=>x.composite).length;if(compositeCount!==48)errors.push(`複合Skill件数が48ではありません: ${compositeCount}`);
 const runtimeContractsCount=compile_results.filter(x=>!!x.runtime_contract_source).length,noContractCount=compile_results.filter(x=>!x.runtime_contract_source).length;
 if(runtimeContractsCount!==rows.length)errors.push(`R06正式Runtime契約のruntimeContracts接続が全件ではありません: ${runtimeContractsCount}/${rows.length}`);
 return{schema_version:'1.2.0',build:'GA-B486.213',generated_at:new Date().toISOString(),test:{id:'R06-MASTER-STRUCTURED-RUNTIME-FINAL-001',mode:'master_registered_structured_skill_composite_runtime_final',entrypoint:'game/index.html'},source:{status:'loaded',project_id:source.project_id,storage:'Studio current project localStorage',selection:{formal_id_format:'SKL-0000',name_prefix:'R06大量複合検査 V',expected_variants:'V01-V48',tags_used:false},master_skill_count:rows.length},compile_results,cases,summary:{master_skill_count:rows.length,compile_passed_count:compile_results.filter(x=>x.compiled_ok&&x.runtime_contract_connected).length,runtime_contracts_count:runtimeContractsCount,no_contract_count:noContractCount,runtime_passed_count:cases.filter(x=>x.passed).length,runtime_case_count:cases.length,composite_case_count:compositeCount,passed:errors.length===0,errors}};
}

function buildFormalRuntimeRegressionReport(){
 const required=['SKL-TEST-ATTACK','SKL-TEST-POISON','SKL-TEST-BUFF-10','SKL-TEST-DEBUFF-10','SKL-TEST-FOLLOW-POISON','SKL-TEST-HEAL-100','SKL-TEST-HEAL-ALL-60','SKL-TEST-SHIELD-100','SKL-TEST-SHIELD-ALL-60','SKL-TEST-SHIELD-40','SKL-TEST-STATUS-ACCURACY-DOWN','SKL-TEST-ATTACK-STATUS-ACCURACY-DOWN','SKL-TEST-CLEANSE-1','SKL-TEST-CLEANSE-ALL','SKL-TEST-CLEANSE-ALL-PARTY','SKL-REVIVE-SINGLE-100','SKL-REVIVE-ALL-60','SKL-COUNTER-ATTACK-100','SKL-COUNTER-TEST-INCOMING-ALL-60','SKL-COUNTER-TEST-ATTACK-STATUS-100','SKL-COVER-SINGLE-ALLY','SKL-COVER-TEST-ALL-ALLIES','SKL-COVER-TEST-USES-1','SKL-COVER-TEST-DURATION-300','SKL-COVER-TEST-DOT-ONLY','SKL-STATUS-ACTION-DISABLED-400','SKL-COOLDOWN-ATTACK-300','SKL-COST-MP-20-CD-300','SKL-ACTIVATION-PRIORITY-HIGH','SKL-ACTIVATION-PRIORITY-LOW'];
 const imported=SKILLS.filter(x=>x.source==='studio_export');
 const production=imported.filter(x=>(x.environment||'production')==='production');
 const validation=imported.filter(x=>(x.environment||'production')==='validation');
 const compileRow=skill=>{const compiled=compileSkillForRuntime(skill);return{id:skill.id,name:skill.name,source:skill.source,environment:skill.environment||'production',compiled_ok:!!compiled.ok,logic_order:compiled.definition?.logicOrder||[],errors:compiled.errors||[]}};
 const production_results=production.map(compileRow);
 const validation_results=validation.map(skill=>{const row=compileRow(skill),expected=skill.expected_result||'rejected';const passed=expected==='accepted'?row.compiled_ok:(!row.compiled_ok&&row.errors.length>0);return{...row,expected_result:expected,validation_passed:passed}});
 const required_results=required.map(id=>{const skill=findSkill(id);return{id,found:!!skill,source:skill?.source||null,environment:skill?.environment||null,compiled_ok:!!(skill&&compileSkillForRuntime(skill).ok)} });
 const production_embedded=SKILLS.filter(x=>x.source!=='studio_export' && (x.environment||'production')==='production').map(x=>x.id);
 const shield_runtime=runFormalShieldRuntimeRegression();
 const status_runtime=runFormalStatusRuntimeRegression();
 const cleanse_runtime=runFormalCleanseRuntimeRegression();
 const revive_runtime=runFormalReviveRuntimeRegression();
 const counter_runtime=typeof runCounterRuntimeRegression==='function'?runCounterRuntimeRegression():{cases:[],summary:{case_count:0,passed_count:0,failed_count:1,passed:false,errors:['COUNTER正式回帰関数がありません']}};
 const cover_runtime=typeof runCoverRuntimeRegression==='function'?runCoverRuntimeRegression():{cases:[],summary:{case_count:0,passed_count:0,failed_count:1,passed:false,errors:['COVER正式回帰関数がありません']}};
 const action_disabled_runtime=typeof runActionDisabledRuntimeRegression==='function'?runActionDisabledRuntimeRegression():{cases:[],summary:{case_count:0,passed_count:0,failed_count:1,passed:false,errors:['ACTION_DISABLED正式回帰関数がありません']}};
 const cooldown_runtime=typeof runCooldownRuntimeRegression==='function'?runCooldownRuntimeRegression():{cases:[],summary:{case_count:0,passed_count:0,failed_count:1,passed:false,errors:['COOLDOWN正式回帰関数がありません']}};
 const cost_runtime=typeof runCostRuntimeRegression==='function'?runCostRuntimeRegression():{cases:[],summary:{case_count:0,passed_count:0,failed_count:1,passed:false,errors:['COST正式回帰関数がありません']}};
 const activation_priority_runtime=typeof runActivationPriorityRuntimeValidation==='function'?runActivationPriorityRuntimeValidation():{cases:[],summary:{case_count:0,passed_count:0,failed_count:1,passed:false,errors:['ACTIVATION_PRIORITY正式回帰関数がありません']}};
 const simultaneous_activation_order_runtime=typeof runSimultaneousActivationOrderValidation==='function'?runSimultaneousActivationOrderValidation():{cases:[],summary:{case_count:0,passed_count:0,failed_count:1,passed:false,errors:['P01-13同時発動順序正式回帰関数がありません']}};
 const r06_master_structured_runtime=runR06MasterStructuredRuntimeFinalRegression();
 const errors=[];
 if(studioSkillBridge.status!=='loaded')errors.push(`Studio出力未読込: ${studioSkillBridge.status}`);
 if(!studioSkillBridge.data_version)errors.push('data_versionがありません');
 for(const row of required_results){if(!row.found)errors.push(`${row.id}がありません`);else if(row.source!=='studio_export')errors.push(`${row.id}が固定定義です`);else if(row.environment!=='production')errors.push(`${row.id}がproductionではありません`);else if(!row.compiled_ok)errors.push(`${row.id}のコンパイルに失敗しました`)}
 for(const row of production_results){if(!row.compiled_ok)errors.push(`${row.id}: ${row.errors.join(', ')}`)}
 for(const row of validation_results){if(!row.validation_passed)errors.push(`${row.id}: validation定義が期待どおり拒否されませんでした`)}
 if(production_embedded.length)errors.push(`正式運用対象に固定定義が残っています: ${production_embedded.join(', ')}`);
 errors.push(...shield_runtime.summary.errors);
 errors.push(...status_runtime.summary.errors);
 errors.push(...cleanse_runtime.summary.errors);
 errors.push(...revive_runtime.summary.errors);
 errors.push(...counter_runtime.summary.errors);
 errors.push(...cover_runtime.summary.errors);
 errors.push(...action_disabled_runtime.summary.errors);
 errors.push(...cooldown_runtime.summary.errors);
 errors.push(...cost_runtime.summary.errors);
 errors.push(...activation_priority_runtime.summary.errors);
 errors.push(...simultaneous_activation_order_runtime.summary.errors);
 errors.push(...r06_master_structured_runtime.summary.errors);
 return{schema_version:'1.9.0',build:'GA-B486.213',generated_at:new Date().toISOString(),test:{id:'TAG-FORMAL-RUNTIME-REGRESSION-001',mode:'formal_runtime_environment_separation_plus_r06_master_structured_composite_runtime_execution',entrypoint:'game/index.html'},source:{status:studioSkillBridge.status,url:studioSkillBridge.source_url,data_version:studioSkillBridge.data_version,generated_by:studioSkillBridge.generated_by,imported_count:imported.length},required_results,production_results,validation_results,shield_runtime,status_runtime,cleanse_runtime,revive_runtime,counter_runtime,cover_runtime,action_disabled_runtime,cooldown_runtime,cost_runtime,activation_priority_runtime,simultaneous_activation_order_runtime,r06_master_structured_runtime,dependency_audit:{production_embedded_ids:production_embedded,studio_production_ids:production.map(x=>x.id),studio_validation_ids:validation.map(x=>x.id)},summary:{required_count:required.length,required_studio_sourced:required_results.filter(x=>x.source==='studio_export'&&x.environment==='production').length,production_compile_count:production_results.filter(x=>x.compiled_ok).length,production_definition_count:production_results.length,validation_expected_rejection_count:validation_results.filter(x=>x.validation_passed).length,validation_definition_count:validation_results.length,production_embedded_count:production_embedded.length,shield_runtime_passed_count:shield_runtime.summary.passed_count,shield_runtime_case_count:shield_runtime.summary.case_count,status_runtime_passed_count:status_runtime.summary.passed_count,status_runtime_case_count:status_runtime.summary.case_count,cleanse_runtime_passed_count:cleanse_runtime.summary.passed_count,cleanse_runtime_case_count:cleanse_runtime.summary.case_count,revive_runtime_passed_count:revive_runtime.summary.passed_count,revive_runtime_case_count:revive_runtime.summary.case_count,counter_runtime_passed_count:counter_runtime.summary.passed_count,counter_runtime_case_count:counter_runtime.summary.case_count,cover_runtime_passed_count:cover_runtime.summary.passed_count,cover_runtime_case_count:cover_runtime.summary.case_count,action_disabled_runtime_passed_count:action_disabled_runtime.summary.passed_count,action_disabled_runtime_case_count:action_disabled_runtime.summary.case_count,cooldown_runtime_passed_count:cooldown_runtime.summary.passed_count,cooldown_runtime_case_count:cooldown_runtime.summary.case_count,cost_runtime_passed_count:cost_runtime.summary.passed_count,cost_runtime_case_count:cost_runtime.summary.case_count,activation_priority_runtime_passed_count:activation_priority_runtime.summary.passed_count,activation_priority_runtime_case_count:activation_priority_runtime.summary.case_count,simultaneous_activation_order_runtime_passed_count:simultaneous_activation_order_runtime.summary.passed_count,simultaneous_activation_order_runtime_case_count:simultaneous_activation_order_runtime.summary.case_count,r06_master_skill_count:r06_master_structured_runtime.summary.master_skill_count,r06_master_compile_passed_count:r06_master_structured_runtime.summary.compile_passed_count,r06_master_runtime_passed_count:r06_master_structured_runtime.summary.runtime_passed_count,r06_master_runtime_case_count:r06_master_structured_runtime.summary.runtime_case_count,r06_master_composite_case_count:r06_master_structured_runtime.summary.composite_case_count,r06_runtime_contracts_count:r06_master_structured_runtime.summary.runtime_contracts_count,r06_no_contract_count:r06_master_structured_runtime.summary.no_contract_count,passed:errors.length===0,errors}};
}
function downloadFormalRuntimeRegressionJson(){const report=buildFormalRuntimeRegressionReport(),blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tag-formal-runtime-regression-GA-B486.213-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();URL.revokeObjectURL(a.href);return report}
