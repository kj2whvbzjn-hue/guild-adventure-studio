(function (root, factory) {
  const adapter = typeof module === 'object' && module.exports ? require('./ai-master-adapter.js') : root && root.GKSAIMasterAdapter;
  const api = factory(adapter);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIProgramValidator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Adapter) {
  'use strict';
  if (!Adapter) throw new Error('GKSAIMasterAdapter is required');
  const rank = Object.freeze({ERROR:0,WARNING:1,INFO:2});
  function issue(severity, code, message, location) { return {severity,code,message,...(location||{})}; }
  function duplicates(rows, key) { const seen=new Set(),found=new Set(); for(const row of rows){const id=String(row?.[key]||'');if(id&&seen.has(id))found.add(id);seen.add(id);}return [...found].sort(); }
  function cycleNodes(nodes, edges) {
    const graph=new Map(nodes.map((node)=>[node.instance_id,[]]));
    for(const edge of edges)if(graph.has(edge.from?.node_id)&&graph.has(edge.to?.node_id))graph.get(edge.from.node_id).push(edge.to.node_id);
    graph.forEach((rows)=>rows.sort());
    const visiting=new Set(),done=new Set(),cycles=new Set();
    function walk(id,path){if(visiting.has(id)){const at=path.indexOf(id),cycle=[...path.slice(at),id];cycles.add(cycle.join(' → '));return;}if(done.has(id))return;visiting.add(id);for(const next of graph.get(id)||[])walk(next,[...path,id]);visiting.delete(id);done.add(id);}
    [...graph.keys()].sort().forEach((id)=>walk(id,[])); return [...cycles].sort();
  }
  function validate(program, projectData) {
    const source=program&&typeof program==='object'?program:{}, data=projectData||{}, nodes=Array.isArray(source.nodes)?source.nodes:[], edges=Array.isArray(source.edges)?source.edges:[], subroutines=Array.isArray(source.subroutines)?source.subroutines:[], issues=[];
    if(!String(source.id||'').trim())issues.push(issue('ERROR','AI_PROGRAM_ID_REQUIRED','AIプログラムIDが必要です。'));
    if(!String(source.name||'').trim())issues.push(issue('ERROR','AI_PROGRAM_NAME_REQUIRED','AIプログラム名が必要です。'));
    if(!nodes.length)issues.push(issue('ERROR','AI_NODE_REQUIRED','AI部品を1件以上配置してください。'));
    const nodeIds=new Set(nodes.map((node)=>String(node?.instance_id||'')).filter(Boolean));
    duplicates(nodes,'instance_id').forEach((id)=>issues.push(issue('ERROR','AI_NODE_ID_DUPLICATE',`部品IDが重複しています: ${id}`,{node_id:id})));
    duplicates(edges,'edge_id').forEach((id)=>issues.push(issue('ERROR','AI_EDGE_ID_DUPLICATE',`接続IDが重複しています: ${id}`,{edge_id:id})));
    if(nodes.length&&!nodeIds.has(source.entry_node_id))issues.push(issue('ERROR','AI_ENTRY_NOT_FOUND',`開始部品が存在しません: ${source.entry_node_id||'未設定'}`,{node_id:String(source.entry_node_id||'')}));
    const definitions=Adapter.palette(data.masters||{},'',{}), byMaster=new Map(definitions.map((row)=>[row.id,row]));
    const refs={tags:data.tags||[],skills:data.masters?.skills||[]};
    for(const node of [...nodes].sort((a,b)=>String(a.instance_id).localeCompare(String(b.instance_id)))){
      const id=String(node.instance_id||''), definition=byMaster.get(node.master_node_id);
      if(!id)issues.push(issue('ERROR','AI_NODE_ID_REQUIRED','部品インスタンスIDが必要です。'));
      if(!definition){issues.push(issue('ERROR','AI_MASTER_NOT_FOUND',`参照AI部品が存在しません: ${node.master_node_id||'未設定'}`,{node_id:id}));continue;}
      if(definition.node_type!==node.node_type)issues.push(issue('ERROR','AI_NODE_TYPE_MISMATCH',`部品種別がマスターと一致しません: ${node.master_node_id}`,{node_id:id}));
      Adapter.definitionErrors(definition).forEach((message)=>issues.push(issue('ERROR','AI_MASTER_DEFINITION_INVALID',message,{node_id:id})));
      if(node.master_data_version&&node.master_data_version!==definition.data_version)issues.push(issue('WARNING','AI_MASTER_VERSION_STALE',`参照マスター版が更新されています: ${node.master_data_version} → ${definition.data_version}`,{node_id:id}));
      Adapter.validateParameters(definition,node.parameters||{},refs).forEach((message)=>issues.push(issue('ERROR','AI_PARAMETER_INVALID',message,{node_id:id})));
    }
    const adjacency=new Map([...nodeIds].map((id)=>[id,[]]));
    for(const edge of [...edges].sort((a,b)=>String(a.edge_id).localeCompare(String(b.edge_id)))){
      const edgeId=String(edge.edge_id||''), from=edge.from||{}, to=edge.to||{};
      if(!nodeIds.has(from.node_id))issues.push(issue('ERROR','AI_EDGE_FROM_MISSING',`接続元部品が存在しません: ${from.node_id||'未設定'}`,{edge_id:edgeId}));
      if(!nodeIds.has(to.node_id))issues.push(issue('ERROR','AI_EDGE_TO_MISSING',`接続先部品が存在しません: ${to.node_id||'未設定'}`,{edge_id:edgeId}));
      const fromNode=nodes.find((node)=>node.instance_id===from.node_id), toNode=nodes.find((node)=>node.instance_id===to.node_id), fromDef=byMaster.get(fromNode?.master_node_id), toDef=byMaster.get(toNode?.master_node_id);
      if(fromDef&&fromDef.node_type==='action')issues.push(issue('ERROR','AI_ACTION_OUTGOING_EDGE','ACTIONは終端のため後続接続を持てません。',{edge_id:edgeId,node_id:from.node_id}));
      if(fromDef&&!(Array.isArray(fromDef.ports?.outputs)?fromDef.ports.outputs:[]).some((port)=>port.id===from.port_id))issues.push(issue('ERROR','AI_OUTPUT_PORT_INVALID',`出力ポートが存在しません: ${from.port_id||'未設定'}`,{edge_id:edgeId,node_id:from.node_id}));
      if(toDef&&!(Array.isArray(toDef.ports?.inputs)?toDef.ports.inputs:[]).some((port)=>port.id===to.port_id))issues.push(issue('ERROR','AI_INPUT_PORT_INVALID',`入力ポートが存在しません: ${to.port_id||'未設定'}`,{edge_id:edgeId,node_id:to.node_id}));
      if(adjacency.has(from.node_id)&&nodeIds.has(to.node_id))adjacency.get(from.node_id).push(to.node_id);
    }
    if(nodeIds.has(source.entry_node_id)){
      const reached=new Set(),queue=[source.entry_node_id];while(queue.length){const id=queue.shift();if(reached.has(id))continue;reached.add(id);queue.push(...(adjacency.get(id)||[]));}
      [...nodeIds].filter((id)=>!reached.has(id)).sort().forEach((id)=>issues.push(issue('WARNING','AI_NODE_UNREACHABLE',`開始部品から到達できません: ${id}`,{node_id:id})));
    }
    cycleNodes(nodes,edges).forEach((path)=>issues.push(issue('ERROR','AI_CYCLE_UNBOUNDED',`評価上限のない循環があります: ${path}`)));
    duplicates(subroutines,'id').forEach((id)=>issues.push(issue('ERROR','AI_SUBROUTINE_DUPLICATE',`サブルーチンIDが重複しています: ${id}`,{subroutine_id:id})));
    for(const subroutine of subroutines)if(!nodeIds.has(subroutine.entry_node_id))issues.push(issue('ERROR','AI_SUBROUTINE_ENTRY_MISSING',`サブルーチン開始部品が存在しません: ${subroutine.entry_node_id}`,{subroutine_id:String(subroutine.id||'')}));
    const signature=new Set();for(const edge of edges){const key=`${edge.from?.node_id}.${edge.from?.port_id}>${edge.to?.node_id}.${edge.to?.port_id}`;if(signature.has(key))issues.push(issue('ERROR','AI_EDGE_DUPLICATE',`同じ接続が重複しています: ${key}`,{edge_id:String(edge.edge_id||'')}));signature.add(key);}
    const outputUse=new Map(),inputUse=new Map();
    for(const edge of edges){
      const outKey=`${edge.from?.node_id}.${edge.from?.port_id}`,inKey=`${edge.to?.node_id}.${edge.to?.port_id}`;
      const outRows=outputUse.get(outKey)||[];outRows.push(String(edge.edge_id||''));outputUse.set(outKey,outRows);
      const inRows=inputUse.get(inKey)||[];inRows.push(String(edge.edge_id||''));inputUse.set(inKey,inRows);
    }
    for(const [key,ids] of outputUse)if(ids.length>1)issues.push(issue('ERROR','AI_OUTPUT_AMBIGUOUS',`同じ出力ポートに複数の接続があります: ${key}`,{edge_id:ids.sort()[0]}));
    for(const [key,ids] of inputUse)if(ids.length>1)issues.push(issue('ERROR','AI_INPUT_AMBIGUOUS',`同じ入力ポートに複数の接続があります: ${key}`,{edge_id:ids.sort()[0]}));
    for(const node of nodes){
      const id=String(node.instance_id||''),definition=byMaster.get(node.master_node_id);if(!definition)continue;
      if(id!==source.entry_node_id){
        const key=`${id}.in`,count=(inputUse.get(key)||[]).length;
        if(count===0)issues.push(issue('ERROR','AI_INPUT_REQUIRED',`入力ポートが未接続です: ${key}`,{node_id:id}));
      }
      for(const port of Array.isArray(definition.ports?.outputs)?definition.ports.outputs:[]){
        const key=`${id}.${port.id}`,count=(outputUse.get(key)||[]).length;
        if(count===0)issues.push(issue('ERROR','AI_OUTPUT_REQUIRED',`出力ポートが未接続です: ${key}`,{node_id:id}));
      }
    }
    issues.sort((a,b)=>(rank[a.severity]-rank[b.severity])||String(a.node_id||a.edge_id||a.subroutine_id||'').localeCompare(String(b.node_id||b.edge_id||b.subroutine_id||''))||a.code.localeCompare(b.code)||a.message.localeCompare(b.message));
    const summary={ERROR:0,WARNING:0,INFO:0};issues.forEach((row)=>summary[row.severity]++);
    return Object.freeze({valid:summary.ERROR===0,issues:Object.freeze(issues),summary:Object.freeze(summary)});
  }
  return Object.freeze({validate});
});
