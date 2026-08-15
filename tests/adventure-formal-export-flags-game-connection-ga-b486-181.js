const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
function extractFunction(name){
 const start=app.indexOf(`function ${name}(`);assert(start>=0,`${name} missing`);
 let brace=app.indexOf('{',start),depth=0;
 for(let i=brace;i<app.length;i++){if(app[i]==='{')depth++;else if(app[i]==='}'&&--depth===0)return app.slice(start,i+1)}
 throw new Error(`${name} parse failed`);
}
assert(app.includes("flags:'../Export/event/flags.json'"),'Game must load formal Flag definitions');
assert(app.includes('events,flags,monsters'),'Flag document must be part of formal Export load');
assert(app.includes('flags:flags.data'),'Flag definitions must be retained in loaded content');
assert(app.includes('applyAdventureFlagDefaults(content);registerAdventureQuestCards(content);'),'startup/reload must apply Flag defaults before Quest use');
assert(app.includes("function adventureEventCondition(event,flags){return(event?.required_flags||[]).every(id=>Boolean(flags?.[id]));}"),'Event required_flags runtime connection missing');
assert(app.includes('for(const id of event?.set_flags||[])flags[id]=true'),'Event set_flags runtime connection missing');
assert(app.includes('missing_required_flags'),'Quest required_flags runtime connection missing');
assert(app.includes('progress?.set_flags||{}'),'Quest set_flags completion connection missing');
const ctx=vm.createContext({Object,Array,String,Boolean,data:{flags:{'FLAG-KEEP':true,'FLAG-EXISTING-FALSE':false}}});
vm.runInContext(extractFunction('applyAdventureFlagDefaults'),ctx);
ctx.content={flags:[
 {id:'FLAG-DEFAULT-ON',default_value:true},
 {id:'FLAG-DEFAULT-OFF',default_value:false},
 {id:'FLAG-KEEP',default_value:false},
 {id:'FLAG-EXISTING-FALSE',default_value:true},
 {id:'',default_value:true}
]};
vm.runInContext('result=applyAdventureFlagDefaults(content)',ctx);
assert.equal(ctx.result.added,2);
assert.equal(ctx.data.flags['FLAG-DEFAULT-ON'],true);
assert.equal(ctx.data.flags['FLAG-DEFAULT-OFF'],false);
assert.equal(ctx.data.flags['FLAG-KEEP'],true,'existing save Flag must never be overwritten');
assert.equal(ctx.data.flags['FLAG-EXISTING-FALSE'],false,'existing false save Flag must never be overwritten');
console.log('PASS GA-B486.181 formal Export Flag connection: definitions/defaults + required/set runtime path');
