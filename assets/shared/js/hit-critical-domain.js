(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GKHitCriticalDomain=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const INITIAL_CRITICAL_BONUS_DAMAGE_PERCENT=50;
const finite=(v,name)=>{const n=Number(v);if(!Number.isFinite(n))throw Object.assign(new Error(`${name} が数値ではありません。`),{code:'GS11_NUMBER_INVALID',field:name});return n};
function criticalBaseRate({weaponCriticalRate=0,luk=0}={}){return Math.max(0,finite(weaponCriticalRate,'weaponCriticalRate'))*(1+Math.max(0,finite(luk,'luk'))/100)}
function physicalHitRatePercent({accuracy=0,evasion=0}={}){const a=Math.max(0,finite(accuracy,'accuracy')),e=Math.max(0,finite(evasion,'evasion'));if(e<=0)return 100;return Math.max(0,(a/e)*100)}
function magicalHitRatePercent({magicAccuracy=0,magicResistance=0}={}){const a=Math.max(0,finite(magicAccuracy,'magicAccuracy')),r=Math.max(0,finite(magicResistance,'magicResistance'));if(r<=0)return 100;return Math.max(0,Math.min(100,(a/r)*100))}
function resolveHit({criticalRatePercent,damageType='PHYSICAL',accuracy=0,evasion=0,magicAccuracy=0,magicResistance=0,drawCritical,drawHit}={}){
 if(typeof drawCritical!=='function'||typeof drawHit!=='function')throw Object.assign(new Error('drawCritical / drawHit が必要です。'),{code:'GS11_RNG_REQUIRED'});
 const criticalRate=Math.max(0,Math.min(100,finite(criticalRatePercent,'criticalRatePercent'))),criticalRoll=Math.max(0,Math.min(1,finite(drawCritical(),'criticalRoll')))*100,critical=criticalRoll<criticalRate;
 if(critical)return{critical:true,hit:true,critical_rate_percent:criticalRate,critical_roll:criticalRoll,hit_rate_percent:null,hit_roll:null,hit_bypass:'CRITICAL_GUARANTEED_HIT',rng_consumption:{critical:1,hit:0,total:1}};
 const magical=String(damageType||'PHYSICAL').toUpperCase()==='MAGICAL',hitRate=magical?magicalHitRatePercent({magicAccuracy,magicResistance}):physicalHitRatePercent({accuracy,evasion}),hitRoll=Math.max(0,Math.min(1,finite(drawHit(),'hitRoll')))*100;
 return{critical:false,hit:hitRoll<hitRate,critical_rate_percent:criticalRate,critical_roll:criticalRoll,hit_rate_percent:hitRate,hit_roll:hitRoll,hit_bypass:null,rng_consumption:{critical:1,hit:1,total:2}};
}
return Object.freeze({VERSION:'GS-11-1',INITIAL_CRITICAL_BONUS_DAMAGE_PERCENT,criticalBaseRate,physicalHitRatePercent,magicalHitRatePercent,resolveHit});
});
