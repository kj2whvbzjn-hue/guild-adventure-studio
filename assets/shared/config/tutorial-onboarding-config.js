/* Tutorial onboarding configuration — TUTORIAL-ONBOARDING-1.0 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GKTutorialOnboardingConfig=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const stages=Object.freeze([
 Object.freeze({order:1,id:'TUT-PARTY-01',topic:'PARTY',title:'パーティ',start_condition:'ALWAYS',completion_event:'PARTY_FORMATION_SAVED',help_text:'冒険者を選び、パーティ編成と前衛・後衛を設定して保存します。段階完了は編成の保存成功時に判定されます。'}),
 Object.freeze({order:2,id:'TUT-EQUIPMENT-02',topic:'EQUIPMENT',title:'装備',start_condition:'ALWAYS',completion_event:'EQUIPMENT_REEQUIPPED_SAME_INSTANCE',help_text:'装備詳細と要求値を確認し、同じ装備個体を一度解除してから再装備します。要求値を満たさない装備は正常装備として扱いません。'}),
 Object.freeze({order:3,id:'TUT-AI-03',topic:'AI',title:'AI',start_condition:'ALWAYS',completion_event:'FORMAL_AI_PARTY_READY',help_text:'現在パーティ全員にFormal AIを保存し、Skillを必要としない通常攻撃Actionへ到達できる状態にします。Tutorial開始だけを理由にAIやSkillを自動付与しません。'}),
 Object.freeze({order:4,id:'TUT-STONE-04',topic:'STONE',title:'ストーン',start_condition:'ALWAYS',completion_event:'STONE_OPTIONALITY_CONFIRMED',help_text:'Quest準備でStone欄を確認します。Stoneは任意投入で、0個選択でも出撃できます。選択したStoneはQuest開始成立時に消費されます。'}),
 Object.freeze({order:5,id:'TUT-QUEST-05',topic:'QUEST',title:'Quest',start_condition:'ALWAYS',completion_event:'QUEST_RUN_STARTED',help_text:'利用可能なFormal Questの詳細を確認して選択し、通常のQuestRun開始を成立させます。'}),
 Object.freeze({order:6,id:'TUT-WAREHOUSE-REWARD-06',topic:'WAREHOUSE_REWARD',title:'倉庫・報酬',start_condition:'ALWAYS',completion_event:'RETURN_REWARD_THEN_WAREHOUSE_OPENED',help_text:'成功したQuestRunの帰還受取を確定した後、倉庫画面を開きます。預け入れ・引き出しと容量整理は通常の倉庫機能を使用します。'}),
 Object.freeze({order:7,id:'TUT-SKILL-07',topic:'SKILL',title:'Active・Passive',start_condition:'SKILL_ACQUISITION_AVAILABLE',completion_event:'SKILL_ACQUIRED_WITH_REQUIRED_VIEWS',help_text:'SPと能力条件を満たして習得可能になった後、ActiveとPassiveの両画面を確認し、正式SkillまたはPassiveを1件習得します。Activeを習得した場合は戦闘用選択まで完了します。'})
]);
return Object.freeze({schema_version:1,id:'TUTORIAL-ONBOARDING-1.0',stages,allow_full_skip:false,help_unlock:'ON_STAGE_COMPLETION'});
});
