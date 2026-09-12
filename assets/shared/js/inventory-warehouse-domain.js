(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.GKInventoryWarehouseDomain=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const CONTAINER_IDS=Object.freeze(['inventory','warehouse']);
 const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 function fail(code,message,details={}){return{ok:false,code,message,...details}}
 function int(value,path,{min=0}={}){if(!Number.isInteger(value)||value<min)throw Object.assign(new Error(`${path} が不正です。`),{code:'INVENTORY_WAREHOUSE_CONFIG_INVALID',path});return value}
 function positiveInt(value,path){return int(value,path,{min:1})}
 function text(value,path){const out=String(value??'').trim();if(!out)throw Object.assign(new Error(`${path} が必要です。`),{code:'INVENTORY_WAREHOUSE_STATE_INVALID',path});return out}
 function normalizeConfig(input){
  if(!isObject(input))throw Object.assign(new Error('inventory_economy が必要です。'),{code:'INVENTORY_WAREHOUSE_CONFIG_INVALID',path:'inventory_economy'});
  const id=String(input.id||'').trim();if(!id)throw Object.assign(new Error('inventory_economy.id が必要です。'),{code:'INVENTORY_WAREHOUSE_CONFIG_INVALID',path:'inventory_economy.id'});
  return Object.freeze({
   id,
   inventory_capacity:positiveInt(input.inventory_capacity,'inventory_economy.inventory_capacity'),
   resource_stack_limit:positiveInt(input.resource_stack_limit,'inventory_economy.resource_stack_limit'),
   sell_unit_gold:int(input.sell_unit_gold,'inventory_economy.sell_unit_gold')
  });
 }
 function normalizeCapacity(value,path){return positiveInt(value,path)}
 function normalizeEquipment(row,path){
  if(!isObject(row))throw Object.assign(new Error(`${path} が不正です。`),{code:'INVENTORY_WAREHOUSE_STATE_INVALID',path});
  return{instance_id:text(row.instance_id,`${path}.instance_id`),equipment_id:text(row.equipment_id,`${path}.equipment_id`),owner_id:row.owner_id==null||String(row.owner_id).trim()===''?null:String(row.owner_id).trim()};
 }
 function normalizeStack(row,path){
  if(!isObject(row))throw Object.assign(new Error(`${path} が不正です。`),{code:'INVENTORY_WAREHOUSE_STATE_INVALID',path});
  return{resource_kind:text(row.resource_kind,`${path}.resource_kind`),resource_id:text(row.resource_id,`${path}.resource_id`),count:positiveInt(row.count,`${path}.count`)};
 }
 function normalizeContainer(input,path){
  const source=isObject(input)?input:{};
  const equipment=Array.isArray(source.equipment_instances)?source.equipment_instances.map((row,i)=>normalizeEquipment(row,`${path}.equipment_instances[${i}]`)):[];
  const resources=Array.isArray(source.resource_stacks)?source.resource_stacks.map((row,i)=>normalizeStack(row,`${path}.resource_stacks[${i}]`)):[];
  const instanceIds=new Set();for(const row of equipment){if(instanceIds.has(row.instance_id))throw Object.assign(new Error(`${path} に重複装備個体があります。`),{code:'DUPLICATE_EQUIPMENT_INSTANCE',path,instance_id:row.instance_id});instanceIds.add(row.instance_id);}
  const stackKeys=new Set();for(const row of resources){const key=`${row.resource_kind}\u0000${row.resource_id}`;if(stackKeys.has(key))throw Object.assign(new Error(`${path} に重複Resource Stackがあります。`),{code:'DUPLICATE_RESOURCE_STACK',path,resource_kind:row.resource_kind,resource_id:row.resource_id});stackKeys.add(key);}
  return{equipment_instances:equipment,resource_stacks:resources};
 }
 function normalizeState(input){
  if(!isObject(input))throw Object.assign(new Error('state が必要です。'),{code:'INVENTORY_WAREHOUSE_STATE_INVALID',path:'state'});
  const inventory=normalizeContainer(input.inventory,'state.inventory'),warehouse=normalizeContainer(input.warehouse,'state.warehouse');
  const all=new Map();for(const [containerId,container] of [['inventory',inventory],['warehouse',warehouse]])for(const row of container.equipment_instances){if(all.has(row.instance_id))throw Object.assign(new Error('装備個体IDが所持品と倉庫で重複しています。'),{code:'DUPLICATE_EQUIPMENT_INSTANCE',path:'state',instance_id:row.instance_id,containers:[all.get(row.instance_id),containerId]});all.set(row.instance_id,containerId);}
  return{inventory,warehouse};
 }
 function stackKey(kind,id){return`${kind}\u0000${id}`}
 function occupiedSlots(container){return container.equipment_instances.length+container.resource_stacks.length}
 function capacityFor(config,warehouseCapacity,containerId){return containerId==='inventory'?config.inventory_capacity:warehouseCapacity}
 function validateStateAgainstConfig(state,config,warehouseCapacity){
  for(const id of CONTAINER_IDS){const container=state[id],capacity=capacityFor(config,warehouseCapacity,id);if(occupiedSlots(container)>capacity)return fail('CONTAINER_CAPACITY_EXCEEDED','容量を超えています。',{container_id:id,capacity,occupied_slots:occupiedSlots(container)});for(const stack of container.resource_stacks)if(stack.count>config.resource_stack_limit)return fail('RESOURCE_STACK_LIMIT_EXCEEDED','Resource Stack上限を超えています。',{container_id:id,resource_kind:stack.resource_kind,resource_id:stack.resource_id,count:stack.count,stack_limit:config.resource_stack_limit});}
  return{ok:true};
 }
 function prepare(configInput,stateInput,warehouseCapacityInput){let config,state,warehouseCapacity;try{config=normalizeConfig(configInput);state=normalizeState(stateInput);warehouseCapacity=normalizeCapacity(warehouseCapacityInput,'warehouse_capacity')}catch(error){return fail(error.code||'INVENTORY_WAREHOUSE_STATE_INVALID',String(error.message||error),{path:error.path||'',instance_id:error.instance_id,resource_kind:error.resource_kind,resource_id:error.resource_id})}const valid=validateStateAgainstConfig(state,config,warehouseCapacity);if(!valid.ok)return valid;return{ok:true,config,state,warehouse_capacity:warehouseCapacity}}
 function assertContainers(from,to){if(!CONTAINER_IDS.includes(from)||!CONTAINER_IDS.includes(to)||from===to)return fail('TRANSFER_CONTAINER_INVALID','移動元と移動先が不正です。',{from_container:from,to_container:to});return{ok:true}}
 function planResourceTransfer(configInput,stateInput,request,warehouseCapacityInput){
  const prepared=prepare(configInput,stateInput,warehouseCapacityInput);if(!prepared.ok)return prepared;const req=isObject(request)?request:{},from=String(req.from_container||''),to=String(req.to_container||''),containers=assertContainers(from,to);if(!containers.ok)return containers;
  let count;try{count=positiveInt(req.count,'request.count')}catch(error){return fail('TRANSFER_QUANTITY_INVALID','移動数量は1以上の整数が必要です。',{count:req.count})}
  const kind=String(req.resource_kind||'').trim(),id=String(req.resource_id||'').trim();if(!kind||!id)return fail('RESOURCE_IDENTITY_REQUIRED','resource_kind と resource_id が必要です。',{resource_kind:kind,resource_id:id});
  const next=clone(prepared.state),source=next[from],dest=next[to],key=stackKey(kind,id),sourceIndex=source.resource_stacks.findIndex(row=>stackKey(row.resource_kind,row.resource_id)===key);if(sourceIndex<0)return fail('RESOURCE_SOURCE_NOT_FOUND','移動元にResource Stackがありません。',{from_container:from,resource_kind:kind,resource_id:id});
  const sourceStack=source.resource_stacks[sourceIndex];if(sourceStack.count<count)return fail('RESOURCE_QUANTITY_INSUFFICIENT','移動元の数量が不足しています。',{available:sourceStack.count,requested:count});
  const destIndex=dest.resource_stacks.findIndex(row=>stackKey(row.resource_kind,row.resource_id)===key),destCount=destIndex>=0?dest.resource_stacks[destIndex].count:0;if(destCount+count>prepared.config.resource_stack_limit)return fail('RESOURCE_STACK_LIMIT_EXCEEDED','移動先のResource Stack上限を超えます。',{to_container:to,resource_kind:kind,resource_id:id,count:destCount+count,stack_limit:prepared.config.resource_stack_limit});
  if(destIndex<0&&occupiedSlots(dest)>=capacityFor(prepared.config,prepared.warehouse_capacity,to))return fail('CONTAINER_FULL','移動先に空き容量がありません。',{to_container:to,capacity:capacityFor(prepared.config,prepared.warehouse_capacity,to),occupied_slots:occupiedSlots(dest)});
  sourceStack.count-=count;if(sourceStack.count===0)source.resource_stacks.splice(sourceIndex,1);if(destIndex>=0)dest.resource_stacks[destIndex].count+=count;else dest.resource_stacks.push({resource_kind:kind,resource_id:id,count});
  return{ok:true,operation:'RESOURCE_TRANSFER',from_container:from,to_container:to,resource_kind:kind,resource_id:id,count,next_state:next};
 }
 function planEquipmentTransfer(configInput,stateInput,request,warehouseCapacityInput){
  const prepared=prepare(configInput,stateInput,warehouseCapacityInput);if(!prepared.ok)return prepared;const req=isObject(request)?request:{},from=String(req.from_container||''),to=String(req.to_container||''),containers=assertContainers(from,to);if(!containers.ok)return containers;const instanceId=String(req.instance_id||'').trim();if(!instanceId)return fail('EQUIPMENT_INSTANCE_ID_REQUIRED','instance_id が必要です。');
  const next=clone(prepared.state),source=next[from],dest=next[to],index=source.equipment_instances.findIndex(row=>row.instance_id===instanceId);if(index<0)return fail('EQUIPMENT_SOURCE_NOT_FOUND','移動元に装備個体がありません。',{from_container:from,instance_id:instanceId});const item=source.equipment_instances[index],expectedOwner=req.owner_id==null||String(req.owner_id).trim()===''?null:String(req.owner_id).trim();if(item.owner_id!==expectedOwner)return fail('EQUIPMENT_OWNER_MISMATCH','装備個体の所有者が一致しません。',{instance_id:instanceId,actual_owner_id:item.owner_id,expected_owner_id:expectedOwner});
  if(dest.equipment_instances.some(row=>row.instance_id===instanceId))return fail('DUPLICATE_EQUIPMENT_INSTANCE','移動先に同じ装備個体IDがあります。',{instance_id:instanceId});if(occupiedSlots(dest)>=capacityFor(prepared.config,prepared.warehouse_capacity,to))return fail('CONTAINER_FULL','移動先に空き容量がありません。',{to_container:to,capacity:capacityFor(prepared.config,prepared.warehouse_capacity,to),occupied_slots:occupiedSlots(dest)});
  source.equipment_instances.splice(index,1);dest.equipment_instances.push(item);return{ok:true,operation:'EQUIPMENT_TRANSFER',from_container:from,to_container:to,instance_id:instanceId,next_state:next};
 }
 function quoteSale(configInput,request){let config;try{config=normalizeConfig(configInput)}catch(error){return fail(error.code||'INVENTORY_WAREHOUSE_CONFIG_INVALID',String(error.message||error),{path:error.path||''})}const req=isObject(request)?request:{};let count;try{count=positiveInt(req.count,'request.count')}catch(_error){return fail('TRANSFER_QUANTITY_INVALID','売却数量は1以上の整数が必要です。',{count:req.count})}return{ok:true,count,unit_gold:config.sell_unit_gold,total_gold:config.sell_unit_gold*count}}
 return Object.freeze({VERSION:'GS-29-1',CONTAINER_IDS,normalizeConfig,normalizeState,occupiedSlots,validateStateAgainstConfig,planResourceTransfer,planEquipmentTransfer,quoteSale});
});
