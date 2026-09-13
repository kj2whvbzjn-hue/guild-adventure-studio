(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GKPlayerSettingsDomain=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function fail(code,message,details={}){const e=new Error(message);e.code=code;Object.assign(e,details);throw e;}
function configOf(input){const c=input||globalThis.GKAudioPresentationConfig;if(!isObject(c)||!isObject(c.defaults))fail('PLAYER_SETTINGS_CONFIG_REQUIRED','Audio Presentation Config が必要です。');return c;}
function bool(v,path){if(typeof v!=='boolean')fail('PLAYER_SETTINGS_TYPE_INVALID',`${path} はbooleanが必要です。`,{path});return v;}
function volume(v,path,c){const n=Number(v);if(!Number.isFinite(n)||n<Number(c.volume_min)||n>Number(c.volume_max))fail('PLAYER_SETTINGS_RANGE_INVALID',`${path} が範囲外です。`,{path,value:v});return n;}
function choice(v,path,rows){if(!rows.includes(v))fail('PLAYER_SETTINGS_CHOICE_INVALID',`${path} が選択肢外です。`,{path,value:v,allowed:[...rows]});return v;}
function normalize(input={},config=null){
 const c=configOf(config),d=c.defaults,s=isObject(input)?input:{};
 return Object.freeze({
  bgm_volume:volume(s.bgm_volume??d.bgm_volume,'bgm_volume',c),se_volume:volume(s.se_volume??d.se_volume,'se_volume',c),
  bgm_muted:bool(s.bgm_muted??d.bgm_muted,'bgm_muted'),se_muted:bool(s.se_muted??d.se_muted,'se_muted'),
  battle_speed:choice(Number(s.battle_speed??d.battle_speed),'battle_speed',[...(c.battle_speed_options||[])]),
  battle_presentation:choice(String(s.battle_presentation??d.battle_presentation).toUpperCase(),'battle_presentation',[...(c.battle_presentation_options||[])]),
  screen_shake:bool(s.screen_shake??d.screen_shake,'screen_shake')
 });
}
function outputPolicy(input={},config=null){const c=configOf(config),s=normalize(input,c),intensity=c.presentation_intensity?.[s.battle_presentation];if(!intensity)fail('PLAYER_SETTINGS_PRESENTATION_CONFIG_MISSING','演出強度設定がありません。');return Object.freeze({settings:s,bgm_gain:s.bgm_muted?0:s.bgm_volume,se_gain:s.se_muted?0:s.se_volume,bgm_playback_rate:Number(c.bgm_playback_rate),battle_playback_speed:s.battle_speed,flash_intensity:Number(intensity.flash),shake_intensity:s.screen_shake?Number(intensity.shake):0,bgm_crossfade_ms:Number(c.bgm_crossfade_ms)});}
function proposeSave(save,nextSettings,config=null){if(!isObject(save))fail('PLAYER_SETTINGS_SAVE_REQUIRED','Save root が必要です。');const next=clone(save);next.gameSettings=normalize(nextSettings,config);return Object.freeze({operation:'PLAYER_SETTINGS_UPDATE',next_save:next,settings:next.gameSettings});}
function restoreFromSave(save,config=null){if(!isObject(save))fail('PLAYER_SETTINGS_SAVE_REQUIRED','Save root が必要です。');return normalize(save.gameSettings||{},config);}
return Object.freeze({VERSION:'GS-32-1',normalize,outputPolicy,proposeSave,restoreFromSave});
});
