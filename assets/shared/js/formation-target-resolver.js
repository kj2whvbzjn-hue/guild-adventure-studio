(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GKSFormationTargetResolver=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const POSITIONS=Object.freeze(['FRONTLINE','BACKLINE']);
  const RANGES=Object.freeze(['SINGLE','FRONT','BACK','RANDOM','ALL']);
  function fail(code,message,extra={}){throw Object.assign(new Error(message),{code,...extra});}
  function normalizeFormationPosition(value){const v=String(value??'').trim().toUpperCase();if(!POSITIONS.includes(v))fail('FORMATION_POSITION_INVALID',`formationPositionはFRONTLINE/BACKLINEが必要です: ${value??'(missing)'}`,{value:value??null});return v;}
  function normalizeRange(value){const v=String(value??'').trim().toUpperCase();if(v==='PIERCE')fail('PIERCE_RANGE_ABOLISHED','PIERCEは廃止済みです。');if(!RANGES.includes(v))fail('TARGET_RANGE_INVALID',`未対応Rangeです: ${value??'(missing)'}`,{range:v||null});return v;}
  function normalizeSide(value){const v=String(value??'').trim().toUpperCase();if(!['SELF','ALLY','ENEMY','CORPSE'].includes(v))fail('TARGET_SIDE_INVALID',`未対応Target sideです: ${value??'(missing)'}`,{side:v||null});return v;}
  function assertFormationUnits(units){for(const unit of Array.isArray(units)?units:[]){if(unit?.alive===false)continue;normalizeFormationPosition(unit?.formationPosition??unit?.formation_position);}return units;}
  function resolveLegalTargetCandidates({actor,units,targetContract}={}){
    if(!actor)fail('TARGET_ACTOR_REQUIRED','Target解決にはactorが必要です。');
    const rows=Array.isArray(units)?units:[];assertFormationUnits(rows);
    const side=normalizeSide(targetContract?.side),range=normalizeRange(targetContract?.range),actorSide=String(actor.side||'');
    let pool;
    if(side==='SELF')pool=actor.alive===false?[]:[actor];
    else if(side==='ALLY')pool=rows.filter(x=>x.alive!==false&&String(x.side||'')===actorSide);
    else if(side==='CORPSE')pool=rows.filter(x=>x.alive===false&&Number(x.hp)<=0&&String(x.side||'')===actorSide);
    else pool=rows.filter(x=>x.alive!==false&&String(x.side||'')!==actorSide);
    if(side==='ALLY'&&targetContract?.excludeSelf===true)pool=pool.filter(x=>String(x.id)!==String(actor.id));
    if(side!=='ENEMY'||side==='CORPSE')return pool;
    if(range==='SINGLE'||range==='FRONT')return pool.filter(x=>normalizeFormationPosition(x.formationPosition??x.formation_position)==='FRONTLINE');
    if(range==='BACK'||range==='RANDOM'||range==='ALL')return pool;
    return [];
  }
  function sampleTargetsWithReplacement(candidates,targetCount,rng){const pool=Array.isArray(candidates)?candidates:[],count=Math.max(1,Number(targetCount)||1);if(!pool.length)return[];if(typeof rng!=='function')fail('TARGET_RNG_REQUIRED','RANDOM抽選には外部注入RNGが必要です。');const out=[];for(let i=0;i<count;i++)out.push(pool[Math.floor(rng()*pool.length)]);return out;}
  function applyForcedAdvance(units,side){const rows=(Array.isArray(units)?units:[]).filter(x=>String(x.side||'')===String(side||'')&&x.alive!==false);if(!rows.length)return false;if(rows.some(x=>normalizeFormationPosition(x.formationPosition??x.formation_position)==='FRONTLINE'))return false;let changed=false;for(const unit of rows){if(normalizeFormationPosition(unit.formationPosition??unit.formation_position)==='BACKLINE'){unit.formationPosition='FRONTLINE';changed=true;}}return changed;}
  return Object.freeze({POSITIONS,RANGES,normalizeFormationPosition,normalizeRange,normalizeSide,resolveLegalTargetCandidates,sampleTargetsWithReplacement,applyForcedAdvance});
});
