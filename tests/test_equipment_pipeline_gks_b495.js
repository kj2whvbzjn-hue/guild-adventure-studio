const fs=require('fs');const path=require('path');const vm=require('vm');
const root=path.resolve(__dirname,'..');
global.window=global;global.data={tags:[{id:'WEAPON_STAFF'}],masters:{equipment:[]}};let persistCount=0;global.persist=()=>{persistCount++};
global.document={readyState:'loading',addEventListener:()=>{},querySelector:()=>null,getElementById:()=>null};
global.fetch=async rel=>{const p=path.resolve(root,'studio',String(rel).replace(/^\.\//,''));return {ok:true,status:200,json:async()=>JSON.parse(fs.readFileSync(p,'utf8'))}};
vm.runInThisContext(fs.readFileSync(path.join(root,'studio/equipment/equipment-generator.js'),'utf8'),{filename:'equipment-generator.js'});
(async()=>{
 await GKSEquipmentGenerator.initialize();
 if(GKSEquipmentGenerator.GENERATOR_VERSION!=='1.3.0')throw new Error('generator version');
 const sim=GKSEquipmentGenerator.simulateBatch({kind:'weapon',base_item_types:['片手剣','杖'],item_level:{min:1,max:2},id_prefix:'SIM'});
 if(sim.summary.count!==4||sim.summary.invalid!==0||sim.commit_allowed!==false)throw new Error('batch simulation failed');
 if(data.masters.equipment.length!==0||persistCount!==0)throw new Error('simulation must not persist');
 const batch=GKSEquipmentGenerator.generateBatch({kind:'armor',base_item_types:['重装'],armor_slots:['鎧','頭'],item_level_min:1,item_level_max:2,id_prefix:'ARM'});
 if(batch.summary.count!==4||batch.summary.invalid!==0)throw new Error('batch preview failed');
 const rows=GKSEquipmentGenerator.commitBatch();
 if(rows.length!==4||data.masters.equipment.length!==4||persistCount!==1)throw new Error('batch commit failed');
 const ai=GKSEquipmentGenerator.prepareAiRequest({kind:'weapon',base_item_types:['片手剣'],item_level:{min:1,max:3},id_prefix:'AI',seed:'x'});
 if(ai.summary.count!==3||ai.summary.invalid!==0)throw new Error('AI request pipeline failed');
 let blocked=false;try{GKSEquipmentGenerator.prepareAiRequest({kind:'weapon',base_item_type:'片手剣',item_level_min:1,item_level_max:1,attack:999});}catch(e){blocked=String(e.message).includes('正式な数値項目');}
 if(!blocked)throw new Error('AI numeric authority must be blocked');
 const cfg=JSON.parse(fs.readFileSync(path.join(root,'studio/equipment/equipment-balance-config.json'),'utf8'));
 cfg.growth.armor.hp['2']=1.5;GKSEquipmentGenerator.setConfigForTest(cfg);
 const grown=GKSEquipmentGenerator.generate({kind:'armor',base_item_type:'重装',armor_slot:'鎧',item_level:2,id:'GROW'});
 if(grown.record.required_vit!==12||grown.record.hp_bonus!==360||grown.record.mp_bonus!==120)throw new Error('armor growth separation failed');
 console.log('EQUIPMENT_PIPELINE_GKS_B495_OK');
})().catch(e=>{console.error(e);process.exit(1)});
