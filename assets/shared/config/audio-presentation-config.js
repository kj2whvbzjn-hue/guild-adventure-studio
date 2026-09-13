(function(root){'use strict';
root.GKAudioPresentationConfig=Object.freeze({
  id:'AUDIO-PRESENTATION-1.0',
  defaults:Object.freeze({bgm_volume:0.60,se_volume:0.80,bgm_muted:false,se_muted:false,battle_speed:1,battle_presentation:'NORMAL',screen_shake:true}),
  battle_speed_options:Object.freeze([1,2,4]),
  battle_presentation_options:Object.freeze(['NORMAL','REDUCED']),
  volume_min:0,volume_max:1,
  bgm_crossfade_ms:800,
  presentation_intensity:Object.freeze({NORMAL:Object.freeze({flash:1,shake:1}),REDUCED:Object.freeze({flash:0.35,shake:0.35})}),
  bgm_playback_rate:1,
  bgm_assets:Object.freeze({TITLE:'BGM_TITLE',GUILD:'BGM_GUILD',ADVENTURE:'BGM_ADVENTURE',BATTLE:'BGM_BATTLE',STORY:'BGM_STORY'})
});
})(typeof globalThis!=='undefined'?globalThis:this);
