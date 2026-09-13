(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GKWeaponGenerationDomain=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function fail(code,message,details={}){return{ok:false,code,message,...details}}
function generate(input){
 const s=input&&typeof input==='object'?input:{},cfg=s.config&&typeof s.config==='object'?s.config:null;
 if(!cfg)return fail('WEAPON_GENERATION_CONFIG_REQUIRED','正式Weapon Generation Configが必要です。');
 const i=Number(s.item_level),range=cfg.item_level||{};if(!Number.isInteger(i)||i<Number(range.min)||i>Number(range.max))return fail('WEAPON_ITEM_LEVEL_OUT_OF_RANGE','iLvが正式範囲外です。',{item_level:i,min:Number(range.min),max:Number(range.max)});
 const type=String(s.base_item_type||''),c=cfg.weapon?.requirement_coefficients?.[type];if(!c)return fail('WEAPON_TYPE_UNKNOWN','未定義の武器種です。',{base_item_type:type});
 const perf=cfg.weapon.performance||{},growth=cfg.growth?.weapon||{};
 const gm=(metric)=>{if(growth.enabled!==true)return 1;const rows=growth[metric]||growth.default||{};const n=Number(rows[String(i)]??rows[i]??1);if(!Number.isFinite(n)||n<0)throw new Error(`Growth設定が不正です: weapon.${metric}.iLv${i}`);return n};
 const required_str=i*Number(c.str),required_dex=i*Number(c.dex),required_int=i*Number(c.int);
 const attack=required_str*Number(perf.attack_multiplier)*gm('attack'),accuracy=required_dex*Number(perf.accuracy_multiplier)*gm('accuracy'),magic_accuracy=(required_int+required_dex)*2,magic_weapon_bonus=required_int*Number(c.str)*gm('magic_weapon_bonus'),weapon_critical_rate=Number(perf.weapon_critical_rate),shield=type==='盾';
 return{ok:true,base_item_type:type,item_level:i,required_str,required_dex,required_int,attack,accuracy,magic_accuracy,magic_weapon_bonus,weapon_critical_rate,...(shield?{block_rate:Number(perf.block_rate_base)+Number(perf.block_rate_per_item_level)*(i-1),block_damage_cut_rate:Number(perf.block_damage_cut_rate)}:{})};
}
function assertExportMatches(rows,config){
 if(!Array.isArray(rows))return fail('WEAPON_EXPORT_INVALID','Equipment Export dataが配列ではありません。');
 const types=Object.keys(config?.weapon?.requirement_coefficients||{}),levels=[];for(let i=Number(config?.item_level?.min);i<=Number(config?.item_level?.max);i++)levels.push(i);
 const mismatches=[];for(const type of types)for(const itemLevel of levels){const expected=generate({base_item_type:type,item_level:itemLevel,config});const row=rows.find(x=>String(x?.generation?.base_item_type??x?.generation?.generation_input?.base_item_type??'')===type&&Number(x?.item_level)===itemLevel);if(!row){mismatches.push({type,item_level:itemLevel,reason:'MISSING'});continue}for(const key of ['required_str','required_dex','required_int','attack','accuracy','magic_accuracy','magic_weapon_bonus','weapon_critical_rate'])if(Number(row[key])!==Number(expected[key]))mismatches.push({type,item_level:itemLevel,field:key,expected:expected[key],actual:row[key]});}
 return mismatches.length?fail('WEAPON_EXPORT_MISMATCH','正式Weapon Exportが生成規則と一致しません。',{mismatches}):{ok:true,weapon_types:types.length,item_levels:levels.length,checked:types.length*levels.length};
}
return Object.freeze({VERSION:'GS-07-2',generate,assertExportMatches});
});
