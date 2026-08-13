const fs=require('fs'),assert=require('assert');
const dx=require('../studio/data-exchange/data-exchange-core.js');

function baseProject(){
 return {
  schema_version:'4.0.0-draft',
  project:{id:'P-B548',updated_at:'R1'},
  tags:[],
  masters:{skills:[],monsters:[],stats:[],status_effects:[],tablets:[],jobs:[],equipment:[],mods:[],ai_conditions:[],ai_targets:[],ai_actions:[]},
  chapters:[]
 };
}
function structuredSkill(id,tags){
 return {
  id,name:id,tags,
  genericRuntime:{
   schemaVersion:1,registryPhase:'R05-H',
   triggerContract:{type:'ON_USE',scope:'SELF',engineEvent:'use',dispatchMode:'RESOLVE_ONLY',priority:0},
   conditionContracts:[],
   effectContracts:[{type:'RESOURCE_CHANGE',resource:'MP',amount:10}],
   applyContracts:[],
   auraEffectContract:null
  }
 };
}
(async()=>{
 const root=baseProject();

 // New-system Skill: tags are legacy/rendering output, not Tag Master references.
 const staged=JSON.parse(JSON.stringify(root));
 staged.masters.skills=[
   structuredSkill('R06-B548-001',['味方','単体','RESOURCE_CHANGE','FUTURE_EFFECT_TYPE_X','MP_COST=0'])
 ];
 const env=await dx.buildEnvelope({rootData:staged,dataset:'skills',ids:['R06-B548-001'],dependencyMode:'direct',studioVersion:'GKS-B550'});
 const dry=await dx.dryRunImport({rootData:root,envelope:env});
 assert.strictEqual(dry.summary.add,1);
 assert.strictEqual(dry.summary.broken_reference,0,'structured Skill runtime tags must not become Tag Master references');

 // Genuine dependency still works: params.required_tags remains an explicit Tag Master reference.
 const staged2=JSON.parse(JSON.stringify(root));
 const s2=structuredSkill('R06-B548-002',['RESOURCE_CHANGE']);
 s2.params={required_tags:['TAG-MISSING']};
 staged2.masters.skills=[s2];
 const env2=await dx.buildEnvelope({rootData:staged2,dataset:'skills',ids:['R06-B548-002'],dependencyMode:'direct',studioVersion:'GKS-B550'});
 const dry2=await dx.dryRunImport({rootData:root,envelope:env2});
 assert.strictEqual(dry2.summary.broken_reference,1,'explicit required_tags dependency must still be enforced');
 assert.ok(dry2.items.some(x=>x.status==='broken_reference'&&x.id==='R06-B548-002'&&String(x.detail).includes('TAG-MISSING')));

 // Transitional old Skill without structured runtime keeps the old tag-reference behavior.
 const staged3=JSON.parse(JSON.stringify(root));
 staged3.masters.skills=[{id:'OLD-SKILL',name:'old',tags:['CUSTOM-TAG-REF']}];
 const env3=await dx.buildEnvelope({rootData:staged3,dataset:'skills',ids:['OLD-SKILL'],dependencyMode:'direct',studioVersion:'GKS-B550'});
 const dry3=await dx.dryRunImport({rootData:root,envelope:env3});
 assert.strictEqual(dry3.summary.broken_reference,1);

 const core=fs.readFileSync('studio/data-exchange/data-exchange-core.js','utf8');
 assert.ok(core.includes("structuredSkill&&dep.dataset==='tags'&&path==='tags'"));
 assert.ok(core.includes('New Skill System: runtime semantics live in genericRuntime'));
 const html=fs.readFileSync('studio/index.html','utf8');
 assert.ok(html.includes('data-exchange-core.js?v=16'));
 console.log('PASS GKS-B550 structured Skill runtime reference boundary');
})().catch(e=>{console.error(e);process.exit(1);});
