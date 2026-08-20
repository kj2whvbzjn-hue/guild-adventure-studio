/**
 * Development Project Impact Analysis.
 * Independent Development Project implementation; no Scenario/CPF runtime/storage/data sharing.
 * GKS-B690
 */
(function(root){
'use strict';

const state={host:null,filter:'open',selectedId:''};

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function attr(v){return esc(v)}
function now(){return state.host?.now?.()||new Date().toISOString()}
function unique(v){return [...new Set((v||[]).map(String).map(x=>x.trim()).filter(Boolean))]}
function nextId(prefix,rows){const used=new Set((rows||[]).map(x=>String(x.id||'')));let n=1,id='';do{id=prefix+String(n++).padStart(5,'0')}while(used.has(id));return id}

function ensure(w){
 if(!w||typeof w!=='object')throw new Error('Development workspace is required.');
 w.system_impacts=Array.isArray(w.system_impacts)?w.system_impacts:[];
 return w;
}
function workspace(){
 const w=state.host?.getWorkspace?.();
 if(!w)throw new Error('Development System Impact host is not ready.');
 return ensure(w);
}
function nodeById(w,id){return (w.system_nodes||[]).find(x=>String(x.id||'')===String(id||''))||null}
function contractById(w,id){return (w.system_contracts||[]).find(x=>String(x.id||'')===String(id||''))||null}
function candidateById(w,id){return (w.specification_candidates||[]).find(x=>String(x.id||'')===String(id||''))||null}
function specificationById(w,id){return (w.specifications||[]).find(x=>String(x.id||'')===String(id||''))||null}

function sourceSystemIds(w,event){
 const ids=new Set(),type=String(event?.target_type||''),id=String(event?.target_id||''),p=event?.payload||{};
 const add=x=>{if(x&&nodeById(w,x))ids.add(String(x))};
 if(type==='SystemNode')add(id);
 if(type==='Contract'){
  const c=contractById(w,id);
  if(c){add(c.producer_system_id);for(const x of c.consumer_system_ids||[])add(x)}
  add(p.producer_system_id);for(const x of p.consumer_system_ids||[])add(x);
 }
 if(type==='Connection'){
  const c=(w.system_connections||[]).find(x=>String(x.id||'')===id);
  if(c){add(c.from_system_id);add(c.to_system_id)}
  add(p.from_system_id);add(p.to_system_id);
 }
 if(type==='Specification'){
  const s=specificationById(w,id);
  add(s?.system_node_id);add(p.system_node_id);
  for(const cid of unique(s?.contract_ids||p.contract_ids)){
   const c=contractById(w,cid);if(c){add(c.producer_system_id);for(const x of c.consumer_system_ids||[])add(x)}
  }
 }
 if(type==='SpecificationCandidate'){
  const c=candidateById(w,id);
  add(c?.system_node_id);add(p.system_node_id);
  for(const cid of unique(c?.contract_ids||p.contract_ids)){
   const ct=contractById(w,cid);if(ct){add(ct.producer_system_id);for(const x of ct.consumer_system_ids||[])add(x)}
  }
 }
 if(type==='WorkBox'){
  for(const c of w.specification_candidates||[]){
   if(String(c.status||'')!=='candidate')continue;
   if((c.material_snapshot?.material_ids||[]).map(String).includes(id))add(c.system_node_id);
  }
 }
 if(type==='Decision'){
  for(const c of w.specification_candidates||[]){
   if(String(c.status||'')!=='candidate')continue;
   if((c.material_snapshot?.decision_ids||[]).map(String).includes(id))add(c.system_node_id);
  }
  for(const s of w.specifications||[]){
   if((s.decision_refs||[]).map(String).includes(id))add(s.system_node_id);
  }
 }
 return [...ids];
}

function downstream(w,startIds){
 const seen=new Set(),queue=[],paths={};
 for(const id of unique(startIds)){seen.add(id);queue.push({id,depth:0,path:[id]});paths[id]={depth:0,path:[id]}}
 while(queue.length){
  const cur=queue.shift();
  for(const c of w.system_connections||[]){
   if(String(c.from_system_id||'')!==cur.id)continue;
   const to=String(c.to_system_id||'');
   if(!to||seen.has(to))continue;
   const next={id:to,depth:cur.depth+1,path:[...cur.path,to]};
   seen.add(to);queue.push(next);paths[to]={depth:next.depth,path:next.path,via_connection_id:String(c.id||''),contract_id:String(c.contract_id||'')};
  }
 }
 return {ids:[...seen],paths};
}

function gatherAffected(w,systemIds){
 const set=new Set(unique(systemIds));
 const specification_ids=(w.specifications||[]).filter(s=>set.has(String(s.system_node_id||''))).map(s=>String(s.id||''));
 const candidate_ids=(w.specification_candidates||[]).filter(c=>set.has(String(c.system_node_id||''))&&String(c.status||'')==='candidate').map(c=>String(c.id||''));
 const connection_ids=(w.system_connections||[]).filter(c=>set.has(String(c.from_system_id||''))||set.has(String(c.to_system_id||''))).map(c=>String(c.id||''));
 const contract_ids=(w.system_contracts||[]).filter(c=>set.has(String(c.producer_system_id||''))||(c.consumer_system_ids||[]).some(x=>set.has(String(x)))).map(c=>String(c.id||''));
 return {specification_ids:unique(specification_ids),candidate_ids:unique(candidate_ids),connection_ids:unique(connection_ids),contract_ids:unique(contract_ids)};
}

const IMPACT_EVENT_TYPES=new Set([
 'SYSTEM_NODE_UPDATED','SYSTEM_NODE_DELETED',
 'SYSTEM_CONTRACT_ADDED','SYSTEM_CONTRACT_UPDATED','SYSTEM_CONTRACT_DELETED',
 'SYSTEM_CONNECTION_ADDED','SYSTEM_CONNECTION_UPDATED','SYSTEM_CONNECTION_DELETED',
 'MATERIAL_ADDED','MATERIAL_UPDATED','MATERIAL_DELETED',
 'DECISION_ADDED','DECISION_UPDATED',
 'SPECIFICATION_ADDED','SPECIFICATION_UPDATED',
 'SPEC_CANDIDATE_ADDED','SPEC_CANDIDATE_UPDATED','SPEC_CANDIDATE_IMPORTED',
 'SPEC_CANDIDATE_APPROVED','SPEC_CANDIDATE_REJECTED'
]);

function sameOpenImpact(w,event,systemIds){
 const signature=unique(systemIds).sort().join('|');
 return (w.system_impacts||[]).find(x=>
  String(x.status||'')==='open' &&
  String(x.trigger_event_type||'')===String(event.type||'') &&
  String(x.trigger_target_type||'')===String(event.target_type||'') &&
  String(x.trigger_target_id||'')===String(event.target_id||'') &&
  unique(x.affected_system_ids).sort().join('|')===signature
 )||null;
}

function analyzeMutation(w,event){
 ensure(w);
 if(!event||!IMPACT_EVENT_TYPES.has(String(event.type||'')))return null;
 const starts=sourceSystemIds(w,event);
 if(!starts.length)return null;
 const graph=downstream(w,starts),affected=gatherAffected(w,graph.ids),existing=sameOpenImpact(w,event,graph.ids),stamp=now();
 if(existing){
  existing.source_event_id=String(event.id||'');
  existing.updated_at=stamp;
  existing.paths=graph.paths;
  existing.affected_specification_ids=affected.specification_ids;
  existing.affected_candidate_ids=affected.candidate_ids;
  existing.affected_connection_ids=affected.connection_ids;
  existing.affected_contract_ids=affected.contract_ids;
  return existing;
 }
 const row={
  id:nextId('IMPACT-',w.system_impacts),
  status:'open',
  source_event_id:String(event.id||''),
  trigger_event_type:String(event.type||''),
  trigger_target_type:String(event.target_type||''),
  trigger_target_id:String(event.target_id||''),
  source_system_ids:unique(starts),
  affected_system_ids:unique(graph.ids),
  affected_specification_ids:affected.specification_ids,
  affected_candidate_ids:affected.candidate_ids,
  affected_connection_ids:affected.connection_ids,
  affected_contract_ids:affected.contract_ids,
  paths:graph.paths,
  note:'',
  created_at:stamp,
  updated_at:stamp,
  resolved_by:'',
  resolved_at:'',
  resolution_note:''
 };
 w.system_impacts.push(row);
 try{root.GKSDevelopmentSystemState?.emit?.(w,'IMPACT_DETECTED','Impact',row.id,{source_event_id:row.source_event_id,trigger_event_type:row.trigger_event_type,affected_system_ids:row.affected_system_ids},{actor:'System'})}catch(_){}
 return row;
}

function openImpactFor(scopeType,id,w=workspace()){
 return (w.system_impacts||[]).filter(x=>String(x.status||'')==='open'&&(
  (scopeType==='SystemNode'&&(x.affected_system_ids||[]).includes(id))||
  (scopeType==='Specification'&&(x.affected_specification_ids||[]).includes(id))||
  (scopeType==='SpecificationCandidate'&&(x.affected_candidate_ids||[]).includes(id))||
  (scopeType==='Connection'&&(x.affected_connection_ids||[]).includes(id))||
  (scopeType==='Contract'&&(x.affected_contract_ids||[]).includes(id))
 ));
}

function candidateImpactGate(candidate,w=workspace()){
 ensure(w);
 const systemId=String(candidate?.system_node_id||'');
 const candidateId=String(candidate?.id||'');
 const targetSpecId=String(candidate?.target_specification_id||'');
 const rows=(w.system_impacts||[]).filter(x=>String(x.status||'')==='open'&&(
  (systemId&&(x.affected_system_ids||[]).map(String).includes(systemId))||
  (candidateId&&(x.affected_candidate_ids||[]).map(String).includes(candidateId))||
  (targetSpecId&&(x.affected_specification_ids||[]).map(String).includes(targetSpecId))
 ));
 return {ok:rows.length===0,system_id:systemId,impact_ids:rows.map(x=>String(x.id||'')),impacts:rows};
}

function ensureReorganizationRequest(candidate,w=workspace(),gate=candidateImpactGate(candidate,w)){
 ensure(w);
 if(!candidate||gate.ok)return null;
 const systemId=String(candidate.system_node_id||''),candidateId=String(candidate.id||''),targetSpecId=String(candidate.target_specification_id||''),stamp=now();
 let row=(w.specification_candidates||[]).find(x=>String(x.status||'')==='reorganization_required'&&String(x.reorganization?.source_candidate_id||'')===candidateId&&String(x.system_node_id||'')===systemId);
 const payload={source_candidate_id:candidateId,source_target_specification_id:targetSpecId,impact_ids:unique(gate.impact_ids),requested_at:stamp,reason:'OPEN_IMPACT'};
 if(row){
  row.reorganization={...(row.reorganization||{}),...payload};
  row.updated_at=stamp;
  return row;
 }
 row={
  id:nextId('SPEC-CAND-',w.specification_candidates),
  category_id:String(candidate.category_id||''),
  target_specification_id:targetSpecId,
  status:'reorganization_required',
  title:`再整理要求: ${candidate.title||targetSpecId||candidateId}`,
  summary:'未解決ImpactがあるためCurrent Specificationへ昇格できません。Impact確認後、この要求を基準にCandidateを再整理してください。',
  body:'',
  acceptance_criteria:String(candidate.acceptance_criteria||''),
  depends_on:unique(candidate.depends_on),
  system_node_id:systemId,
  contract_ids:unique(candidate.contract_ids),
  material_snapshot:structuredClone(candidate.material_snapshot||{}),
  base_specification_hash:String(candidate.base_specification_hash||''),
  candidate_hash:'',
  created_by:'System',
  created_at:stamp,
  updated_at:stamp,
  approval:{status:'blocked',note:'OPEN_IMPACT',approved_by:'',approved_at:''},
  reorganization:payload
 };
 w.specification_candidates.push(row);
 try{root.GKSDevelopmentSystemState?.emit?.(w,'SPEC_CANDIDATE_REORGANIZATION_REQUIRED','SpecificationCandidate',row.id,{source_candidate_id:candidateId,system_node_id:systemId,target_specification_id:targetSpecId,impact_ids:payload.impact_ids},{actor:'System'})}catch(_){}
 return row;
}

function refreshReorganizationRequests(w=workspace()){
 ensure(w);
 const changed=[];
 for(const row of w.specification_candidates||[]){
  if(String(row.status||'')!=='reorganization_required')continue;
  const systemId=String(row.system_node_id||''),targetSpecId=String(row.target_specification_id||''),impactIds=unique(row.reorganization?.impact_ids);
  const open=(w.system_impacts||[]).filter(x=>String(x.status||'')==='open'&&(
   impactIds.includes(String(x.id||''))||
   (systemId&&(x.affected_system_ids||[]).map(String).includes(systemId))||
   (targetSpecId&&(x.affected_specification_ids||[]).map(String).includes(targetSpecId))
  ));
  const next=open.length?'reorganization_required':'reorganization_ready';
  if(row.status!==next){
   row.status=next;row.updated_at=now();
   row.reorganization={...(row.reorganization||{}),resolved_impact_ids:impactIds.filter(id=>!open.some(x=>String(x.id||'')===id)),ready_at:next==='reorganization_ready'?now():''};
   changed.push(row);
   try{root.GKSDevelopmentSystemState?.emit?.(w,next==='reorganization_ready'?'SPEC_CANDIDATE_REORGANIZATION_READY':'SPEC_CANDIDATE_REORGANIZATION_REQUIRED','SpecificationCandidate',row.id,{source_candidate_id:row.reorganization?.source_candidate_id||'',system_node_id:systemId,target_specification_id:targetSpecId,impact_ids:open.map(x=>String(x.id||''))},{actor:'System'})}catch(_){}
  }
 }
 return changed;
}

function syncImpactFlags(w){
 if(!root.GKSDevelopmentSystemState?.setFlag)return [];
 const changed=[];
 const scopes=[
  ['SystemNode',(w.system_nodes||[]).map(x=>String(x.id||''))],
  ['Specification',(w.specifications||[]).map(x=>String(x.id||''))],
  ['SpecificationCandidate',(w.specification_candidates||[]).map(x=>String(x.id||''))],
  ['Connection',(w.system_connections||[]).map(x=>String(x.id||''))],
  ['Contract',(w.system_contracts||[]).map(x=>String(x.id||''))]
 ];
 for(const [type,ids] of scopes){
  for(const id of ids){
   const rows=openImpactFor(type,id,w),r=root.GKSDevelopmentSystemState.setFlag(w,type,id,'IMPACT_OPEN',rows.length>0,{source:'derived',note:rows.length?`${rows.length} open impact(s)`:'no open impact'});
   if(r.changed)changed.push(r.row);
  }
 }
 return changed;
}

function resolveImpact(id,note,actor='Human'){
 const w=workspace(),row=(w.system_impacts||[]).find(x=>String(x.id||'')===String(id||''));
 if(!row||row.status!=='open')return false;
 note=String(note||'').trim();if(!note)throw new Error('解決メモは必須です。');
 const stamp=now();row.status='resolved';row.resolution_note=note;row.resolved_by=actor;row.resolved_at=stamp;row.updated_at=stamp;
 try{root.GKSDevelopmentSystemState?.emit?.(w,'IMPACT_RESOLVED','Impact',row.id,{resolution_note:note},{actor})}catch(_){}
 syncImpactFlags(w);refreshReorganizationRequests(w);
 state.host?.saveWorkspace?.('Development impact resolved');state.host?.refreshWorkspace?.();render();
 return true;
}
function resolvePrompt(id){
 const note=String(prompt('影響確認の解決メモを入力してください。','確認・反映済み')||'').trim();
 if(!note)return;
 try{resolveImpact(id,note,'Human')}catch(e){alert(e.message||e)}
}
function reopenImpact(id){
 const w=workspace(),row=(w.system_impacts||[]).find(x=>String(x.id||'')===String(id||''));if(!row||row.status==='open')return;
 row.status='open';row.resolved_by='';row.resolved_at='';row.resolution_note='';row.updated_at=now();
 try{root.GKSDevelopmentSystemState?.emit?.(w,'IMPACT_REOPENED','Impact',row.id,{}, {actor:'Human'})}catch(_){}
 syncImpactFlags(w);refreshReorganizationRequests(w);state.host?.saveWorkspace?.('Development impact reopened');state.host?.refreshWorkspace?.();render();
}

function systemLabel(w,id){const n=nodeById(w,id);return n?`${n.name||n.id} / ${n.id}`:id}
function triggerLabel(row){return `${row.trigger_event_type} · ${row.trigger_target_type}/${row.trigger_target_id}`}

function setFilter(v){state.filter=v;state.selectedId='';render()}
function select(id){state.selectedId=id;render()}
function back(){state.selectedId='';render()}

function renderDetail(w,mount,row){
 const paths=row.paths||{};
 mount.innerHTML=`<div class="impact-head"><button onclick="GKSDevelopmentSystemImpact.back()">← 一覧</button><div><h3>${esc(row.id)}</h3><div class="small">${esc(triggerLabel(row))}</div></div><span class="badge ${row.status==='open'?'warn':'ok'}">${row.status==='open'?'OPEN':'RESOLVED'}</span></div>
 <div class="impact-detail-grid">
  <section><h4>起点System</h4>${(row.source_system_ids||[]).map(id=>`<div class="impact-pill">${esc(systemLabel(w,id))}</div>`).join('')||'-'}</section>
  <section><h4>影響System</h4>${(row.affected_system_ids||[]).map(id=>`<div class="impact-line"><b>${esc(systemLabel(w,id))}</b><small>depth ${esc(paths[id]?.depth??0)}${paths[id]?.via_connection_id?' / '+esc(paths[id].via_connection_id):''}</small></div>`).join('')||'-'}</section>
  <section><h4>Specification</h4>${(row.affected_specification_ids||[]).map(id=>`<div>${esc(id)} · ${esc(specificationById(w,id)?.title||'')}</div>`).join('')||'-'}</section>
  <section><h4>Candidate</h4>${(row.affected_candidate_ids||[]).map(id=>`<div>${esc(id)} · ${esc(candidateById(w,id)?.title||'')}</div>`).join('')||'-'}</section>
  <section><h4>Contract</h4>${(row.affected_contract_ids||[]).map(id=>`<div>${esc(id)} · ${esc(contractById(w,id)?.name||'')}</div>`).join('')||'-'}</section>
  <section><h4>Connection</h4>${(row.affected_connection_ids||[]).map(id=>`<div>${esc(id)}</div>`).join('')||'-'}</section>
 </div>
 ${row.status==='open'?`<div class="toolbar"><button class="primary" onclick="GKSDevelopmentSystemImpact.resolvePrompt('${attr(row.id)}')">確認済みにする</button></div>`:`<div class="impact-resolution"><b>解決:</b> ${esc(row.resolution_note||'')}<div class="small">${esc(row.resolved_by||'')} / ${esc(row.resolved_at||'')}</div><button onclick="GKSDevelopmentSystemImpact.reopenImpact('${attr(row.id)}')">再オープン</button></div>`}`;
}

function render(){
 const mount=document.getElementById('devSystemImpactMount');if(!mount||!state.host)return;
 const w=workspace();syncImpactFlags(w);
 if(state.selectedId){
  const row=(w.system_impacts||[]).find(x=>x.id===state.selectedId);if(row)return renderDetail(w,mount,row);state.selectedId='';
 }
 let rows=[...(w.system_impacts||[])].sort((a,b)=>String(b.updated_at||b.created_at).localeCompare(String(a.updated_at||a.created_at)));
 if(state.filter==='open')rows=rows.filter(x=>x.status==='open');
 if(state.filter==='resolved')rows=rows.filter(x=>x.status==='resolved');
 mount.innerHTML=`<div class="impact-toolbar"><div class="impact-filters"><button class="${state.filter==='open'?'active':''}" onclick="GKSDevelopmentSystemImpact.setFilter('open')">未解決</button><button class="${state.filter==='all'?'active':''}" onclick="GKSDevelopmentSystemImpact.setFilter('all')">すべて</button><button class="${state.filter==='resolved'?'active':''}" onclick="GKSDevelopmentSystemImpact.setFilter('resolved')">解決済み</button></div><div class="small">変更Event → System Connectionを下流探索 → 再確認対象を保存</div></div>
 <div class="impact-list">${rows.map(r=>`<button class="impact-item" onclick="GKSDevelopmentSystemImpact.select('${attr(r.id)}')"><span><b>${esc(r.id)}</b><small>${esc(triggerLabel(r))}</small></span><span>${r.affected_system_ids?.length||0} System<br><small>${r.affected_specification_ids?.length||0} Spec / ${r.affected_candidate_ids?.length||0} Candidate</small></span><span class="badge ${r.status==='open'?'warn':'ok'}">${r.status==='open'?'OPEN':'RESOLVED'}</span></button>`).join('')||'<div class="small">該当するImpactはありません。</div>'}</div>`;
}

function init(host){state.host=host;ensure(workspace());syncImpactFlags(workspace());render();return api}
const api={init,render,setFilter,select,back,ensure,analyzeMutation,syncImpactFlags,openImpactFor,candidateImpactGate,ensureReorganizationRequest,refreshReorganizationRequests,resolveImpact,resolvePrompt,reopenImpact};
root.GKSDevelopmentSystemImpact=api;
})(window);
