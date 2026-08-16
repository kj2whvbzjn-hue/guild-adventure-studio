const fs=require('fs'),assert=require('assert'),vm=require('vm');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
assert(app.includes("raw.selectedQuestId=typeof raw.selectedQuestId==='string'?raw.selectedQuestId:'';"),'saved formal quest selection must survive normalize before async Export load');
assert(app.includes('let adventureQuestCatalog=[];'),'formal quest catalog missing');
assert(app.includes('function formalAdventureQuests(){return adventureQuestCatalog.slice();}'),'formal quest selector missing');
assert(app.includes('function reconcileFormalAdventureQuestSelection()'),'formal quest selection reconciliation missing');
assert(app.includes("const ql=$('questList'),formalQuests=formalAdventureQuests(),importIssues=formalAdventureQuestImportIssues();"),'quest list must render import-ready formal Export quests only');
assert(app.includes('P7-Bで実行可能なStory Questがありません。StudioでQuest Box / Map / Event条件を設定してExportしてください。'),'empty formal Export guidance missing');
assert(app.includes("if(!bundle)return{started:false,reason:'formal_quest_unavailable'};"),'departure must reject non-formal quest ids');
assert(app.includes("loadAdventureContent().then(content=>{applyAdventureFlagDefaults(content);registerAdventureQuestCards(content);reconcileFormalAdventureQuestSelection();"),'startup must register formal quests then reconcile saved selection');

assert(app.includes("flags:'../Export/event/flags.json'"),'Flag definitions must load from the Formal Export');
assert(app.includes('flags:flags.data'),'loaded Formal Flag definitions must be retained');
assert(app.includes("function adventureEventCondition(event,flags){return(event?.required_flags||[]).every(id=>Boolean(flags?.[id]));}"),'Event required_flags runtime connection missing');
assert(app.includes('for(const id of event?.set_flags||[])flags[id]=true'),'Event set_flags runtime connection missing');
assert(app.includes('missing_required_flags'),'Quest required_flags runtime connection missing');
assert(app.includes('progress?.set_flags||{}'),'Quest set_flags completion connection missing');
function extractFunction(name){const start=app.indexOf(`function ${name}(`);assert(start>=0,`${name} missing`);let brace=app.indexOf('{',start),depth=0;for(let i=brace;i<app.length;i++){if(app[i]==='{')depth++;else if(app[i]==='}'&&--depth===0)return app.slice(start,i+1)}throw new Error(`${name} parse failed`);}
const flagCtx=vm.createContext({Object,Array,String,Boolean,data:{flags:{'FLAG-KEEP':true,'FLAG-EXISTING-FALSE':false}}});
vm.runInContext(extractFunction('applyAdventureFlagDefaults'),flagCtx);
flagCtx.content={flags:[{id:'FLAG-DEFAULT-ON',default_value:true},{id:'FLAG-DEFAULT-OFF',default_value:false},{id:'FLAG-KEEP',default_value:false},{id:'FLAG-EXISTING-FALSE',default_value:true},{id:'',default_value:true}]};
vm.runInContext('result=applyAdventureFlagDefaults(content)',flagCtx);
assert.equal(flagCtx.result.added,2);assert.equal(flagCtx.data.flags['FLAG-DEFAULT-ON'],true);assert.equal(flagCtx.data.flags['FLAG-DEFAULT-OFF'],false);assert.equal(flagCtx.data.flags['FLAG-KEEP'],true);assert.equal(flagCtx.data.flags['FLAG-EXISTING-FALSE'],false);

console.log('adventure-formal-quest-runtime-integration PASS');
