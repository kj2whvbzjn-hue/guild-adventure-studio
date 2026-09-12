(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.GKCharacterGrowthDomain=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const DEFAULT_STATS=Object.freeze(['STR','VIT','AGI','DEX','INT','MND','LUK']);
 const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const integer=(value,path,{min=null,max=null}={})=>{const n=Number(value);if(!Number.isInteger(n)||(min!=null&&n<min)||(max!=null&&n>max))throw Object.assign(new Error(`${path} が不正です。`),{code:'CHARACTER_GROWTH_INPUT_INVALID',path});return n};
 const id=(value,path)=>{const out=String(value??'').trim();if(!out)throw Object.assign(new Error(`${path} が必要です。`),{code:'CHARACTER_GROWTH_INPUT_INVALID',path});return out};
 function growthIncrement(growthValue,randomValue){
  const g=integer(growthValue,'growth_value',{min:0}),roll=Number(randomValue);if(!Number.isFinite(roll)||roll<0||roll>=1)throw Object.assign(new Error('growth random は0以上1未満である必要があります。'),{code:'CHARACTER_GROWTH_RNG_INVALID'});
  const guaranteed=Math.floor(g/10),remainder=g%10,extra=remainder>0&&roll<(remainder/10)?1:0;
  return guaranteed+extra;
 }
 function resolveLevelUp({level,maxLevel,stats,jobId,growthByStat,draw,statKeys=DEFAULT_STATS}={}){
  const currentLevel=integer(level,'level',{min:1}),cap=integer(maxLevel,'max_level',{min:1});if(currentLevel>cap)throw Object.assign(new Error('level が max_level を超えています。'),{code:'CHARACTER_GROWTH_LEVEL_OUT_OF_RANGE'});
  if(currentLevel>=cap)return Object.freeze({ok:false,reason:'max_level',from_level:currentLevel,to_level:currentLevel,job_id:id(jobId,'job_id'),increments:Object.freeze({}),next_stats:Object.freeze(copy(stats||{})),rolls:Object.freeze({})});
  if(!stats||typeof stats!=='object'||Array.isArray(stats))throw Object.assign(new Error('stats が必要です。'),{code:'CHARACTER_GROWTH_INPUT_INVALID',path:'stats'});
  if(!growthByStat||typeof growthByStat!=='object'||Array.isArray(growthByStat))throw Object.assign(new Error('growth_by_stat が必要です。'),{code:'CHARACTER_GROWTH_INPUT_INVALID',path:'growth_by_stat'});
  if(typeof draw!=='function')throw Object.assign(new Error('成長用乱数drawが必要です。'),{code:'CHARACTER_GROWTH_RNG_REQUIRED'});
  const keys=[...statKeys],nextStats=copy(stats),increments={},rolls={};
  for(const stat of keys){
   const current=integer(stats[stat],`stats.${stat}`,{min:0}),g=integer(growthByStat[stat],`growth_by_stat.${stat}`,{min:0}),roll=Number(draw({stat,growth_value:g,level:currentLevel,job_id:String(jobId??'')}));
   const amount=growthIncrement(g,roll);rolls[stat]=roll;increments[stat]=amount;nextStats[stat]=current+amount;
  }
  return Object.freeze({ok:true,reason:null,from_level:currentLevel,to_level:currentLevel+1,job_id:id(jobId,'job_id'),increments:Object.freeze(increments),next_stats:Object.freeze(nextStats),rolls:Object.freeze(rolls)});
 }
 return Object.freeze({VERSION:'GS-02-1',DEFAULT_STATS,growthIncrement,resolveLevelUp});
});
