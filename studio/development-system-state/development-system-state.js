/**
 * Development Project System State / Event Log.
 * Independent Development Project implementation; no Scenario/CPF runtime/storage/data sharing.
 * GKS-B690
 */
(function(root){
'use strict';
const state={host:null,tab:'overview',editingFlagId:''};
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function attr(v){return esc(v)}
function now(){return state.host?.now?.()||new Date().toISOString()}
function unique(v){return [...new Set((v||[]).map(String).map(x=>x.trim()).filter(Boolean))]}
function nextId(prefix,rows){const used=new Set((rows||[]).map(x=>String(x.id||'')));let n=1,id='';do{id=prefix+String(n++).padStart(5,'0')}while(used.has(id));return id}
function ensure(w){
 if(!w||typeof w!=='object')throw new Error('Development workspace is required.');
 w.system_flags=Array.isArray(w.system_flags)?w.system_flags:[];
 w.system_events=Array.isArray(w.system_events)?w.system_events:[];
 return w;
}
function workspace(){const w=state.host?.getWorkspace?.();if(!w)throw new Error('Development System State host is not ready.');return ensure(w)}
function setFlag(w,scopeType,scopeId,key,value,options={}){
 ensure(w);scopeType=String(scopeType||'Project');scopeId=String(scopeId||'');key=String(key||'').trim();
 if(!key)throw new Error('Flag key is required.');
 const source=String(options.source||'derived'),stamp=String(options.at||now());
 let row=w.system_flags.find(x=>x.scope_type===scopeType&&String(x.scope_id||'')===scopeId&&x.key===key&&String(x.source||'derived')===source);
 const changed=!row||JSON.stringify(row.value)!==JSON.stringify(value)||String(row.note||'')!==String(options.note||'');
 if(!row){
  row={id:nextId('FLAG-',w.system_flags),scope_type:scopeType,scope_id:scopeId,key,value,source,note:String(options.note||''),created_at:stamp,updated_at:stamp};
  w.system_flags.push(row);
 }else if(changed){
  row.value=value;row.note=String(options.note||'');row.updated_at=stamp;
 }
 return {row,changed};
}
function emit(w,type,targetType,targetId,payload={},options={}){
 ensure(w);const stamp=String(options.at||now()),row={
  id:nextId('EVT-',w.system_events),
  type:String(type||'EVENT'),
  target_type:String(targetType||'Project'),
  target_id:String(targetId||''),
  payload:(payload&&typeof payload==='object'&&!Array.isArray(payload))?structuredClone(payload):{value:payload},
  actor:String(options.actor||'System'),
  created_at:stamp
 };
 w.system_events.push(row);
 return row;
}
function producedConnectionsComplete(w,nodeId){
 const produced=(w.system_contracts||[]).filter(c=>String(c.producer_system_id||'')===String(nodeId));
 const missing=[];
 for(const c of produced){
  for(const consumer of unique(c.consumer_system_ids)){
   if(!(w.system_connections||[]).some(x=>String(x.from_system_id||'')===String(nodeId)&&String(x.to_system_id||'')===consumer&&String(x.contract_id||'')===String(c.id)))missing.push(`${c.id}->${consumer}`);
  }
 }
 return {ok:missing.length===0,missing};
}
function candidateStaleByTime(w,c){
 const snap=c?.material_snapshot||{},created=String(snap.created_at||c?.created_at||'');
 if(!created)return true;
 for(const id of snap.material_ids||[]){const row=(w.work_boxes||[]).find(x=>String(x.id)===String(id));if(!row||String(row.updated_at||'')>created)return true}
 for(const id of snap.decision_ids||[]){const row=(w.decisions||[]).find(x=>String(x.id)===String(id));if(!row||String(row.updated_at||'')>created||String(row.status||'')!=='Approved')return true}
 return false;
}
function recomputeDerivedFlags(w){
 ensure(w);
 const touched=[];
 for(const n of w.system_nodes||[]){
  const sid=String(n.id||''),specs=(w.specifications||[]).filter(s=>String(s.system_node_id||'')===sid);
  const approved=specs.filter(s=>['Approved','Implemented','Verified'].includes(String(s.status||'')));
  const contracts=(w.system_contracts||[]).filter(c=>String(c.producer_system_id||'')===sid||(c.consumer_system_ids||[]).map(String).includes(sid));
  const conn=producedConnectionsComplete(w,sid);
  const nodeCandidates=(w.specification_candidates||[]).filter(c=>String(c.system_node_id||'')===sid&&String(c.status||'')==='candidate'),candidatePending=nodeCandidates.length>0,candidateStale=nodeCandidates.some(c=>candidateStaleByTime(w,c));
  const defs=[
   ['SPEC_CONNECTED',specs.length>0,`${specs.length} specification(s)`],
   ['SPEC_APPROVED',approved.length>0,`${approved.length} approved specification(s)`],
   ['CONTRACT_DEFINED',contracts.length>0,`${contracts.length} contract(s)`],
   ['CONNECTION_COMPLETE',conn.ok,conn.ok?'all produced contracts connected':`missing: ${conn.missing.join(', ')}`],
   ['CANDIDATE_PENDING',candidatePending,candidatePending?'candidate pending':'no pending candidate'],
   ['CANDIDATE_STALE',candidateStale,candidateStale?'referenced material/decision changed':'candidate snapshot current'],
   ['SYSTEM_READY',approved.length>0&&conn.ok&&!candidatePending&&!candidateStale,'approved specification + connections complete + no pending/stale candidate']
  ];
  for(const [key,value,note] of defs){const r=setFlag(w,'SystemNode',sid,key,value,{source:'derived',note});if(r.changed)touched.push(r.row)}
 }
 for(const c of w.system_connections||[]){
  const validNode=(w.system_nodes||[]).some(n=>n.id===c.from_system_id)&&(w.system_nodes||[]).some(n=>n.id===c.to_system_id);
  let contractOk=true;
  if(c.contract_id){
   const con=(w.system_contracts||[]).find(x=>x.id===c.contract_id);
   contractOk=!!con&&String(con.producer_system_id||'')===String(c.from_system_id||'')&&unique(con.consumer_system_ids).includes(String(c.to_system_id||''));
  }
  const r=setFlag(w,'Connection',String(c.id||''),'CONNECTION_VALID',validNode&&contractOk,{source:'derived',note:(validNode&&contractOk)?'references valid':'reference/contract mismatch'});if(r.changed)touched.push(r.row);
 }
 for(const s of w.specifications||[]){
  const approved=['Approved','Implemented','Verified'].includes(String(s.status||''));
  const r=setFlag(w,'Specification',String(s.id||''),'SPEC_APPROVED',approved,{source:'derived',note:String(s.status||'')});if(r.changed)touched.push(r.row);
 }
 for(const c of w.specification_candidates||[]){
  const pending=String(c.status||'')==='candidate',stale=pending&&candidateStaleByTime(w,c);
  let r=setFlag(w,'SpecificationCandidate',String(c.id||''),'CANDIDATE_PENDING',pending,{source:'derived',note:String(c.status||'')});if(r.changed)touched.push(r.row);
  r=setFlag(w,'SpecificationCandidate',String(c.id||''),'CANDIDATE_STALE',stale,{source:'derived',note:stale?'material/decision newer than snapshot':'snapshot current'});if(r.changed)touched.push(r.row);
 }
 return touched;
}
function recordMutation(w,type,targetType,targetId,payload={}){
 ensure(w);const event=emit(w,type,targetType,targetId,payload,{actor:String(payload.actor||'System')});
 const changed=recomputeDerivedFlags(w);
 let impact=null;
 try{impact=root.GKSDevelopmentSystemImpact?.analyzeMutation?.(w,event)||null;root.GKSDevelopmentSystemImpact?.syncImpactFlags?.(w)}catch(e){console.warn('[DevelopmentSystemImpact]',e)}
 return {event,changed_flags:changed,impact};
}
function eventLabel(t){
 const map={
  SYSTEM_NODE_ADDED:'System Node追加',SYSTEM_NODE_UPDATED:'System Node更新',SYSTEM_NODE_DELETED:'System Node削除',
  SYSTEM_CONTRACT_ADDED:'Contract追加',SYSTEM_CONTRACT_UPDATED:'Contract更新',SYSTEM_CONTRACT_DELETED:'Contract削除',
  SYSTEM_CONNECTION_ADDED:'Connection追加',SYSTEM_CONNECTION_UPDATED:'Connection更新',SYSTEM_CONNECTION_DELETED:'Connection削除',
  SPEC_CANDIDATE_ADDED:'Candidate追加',SPEC_CANDIDATE_UPDATED:'Candidate更新',SPEC_CANDIDATE_IMPORTED:'Candidate取込',
  SPEC_CANDIDATE_APPROVED:'Candidate承認・仕様昇格',SPEC_CANDIDATE_REJECTED:'Candidate却下',SPEC_CANDIDATE_APPROVAL_BLOCKED:'Candidate承認Gate停止',SPEC_CANDIDATE_REORGANIZATION_REQUIRED:'Candidate再整理要求',SPEC_CANDIDATE_REORGANIZATION_READY:'Candidate再整理可能',
  MATERIAL_ADDED:'Material追加',MATERIAL_UPDATED:'Material更新',MATERIAL_DELETED:'Material削除',
  DECISION_ADDED:'Decision追加',DECISION_UPDATED:'Decision更新',
  SPECIFICATION_ADDED:'Specification追加',SPECIFICATION_UPDATED:'Specification更新',
  IMPACT_DETECTED:'Impact検出',IMPACT_RESOLVED:'Impact解決',IMPACT_REOPENED:'Impact再オープン',
  FLAG_CHANGED:'Flag変更'
 };return map[t]||t;
}
function targetName(w,type,id){
 if(type==='SystemNode')return (w.system_nodes||[]).find(x=>x.id===id)?.name||id;
 if(type==='Connection')return id;
 if(type==='Contract')return (w.system_contracts||[]).find(x=>x.id===id)?.name||id;
 if(type==='Specification')return (w.specifications||[]).find(x=>x.id===id)?.title||id;
 if(type==='SpecificationCandidate')return (w.specification_candidates||[]).find(x=>x.id===id)?.title||id;
 return id||type;
}
function setTab(tab){state.tab=tab;state.editingFlagId='';render()}
function startFlag(id=''){state.tab='flags';state.editingFlagId=id||'__NEW__';render()}
function saveManualFlag(){
 const w=workspace(),id=state.editingFlagId==='__NEW__'?'':state.editingFlagId,old=id?w.system_flags.find(x=>x.id===id):null;
 const scopeType=String(document.getElementById('dstateFlagScopeType')?.value||'SystemNode'),scopeId=String(document.getElementById('dstateFlagScopeId')?.value||'').trim(),key=String(document.getElementById('dstateFlagKey')?.value||'').trim();
 if(!scopeId||!key)return alert('Scope IDとFlag Keyを入力してください。');
 let raw=String(document.getElementById('dstateFlagValue')?.value||'').trim(),value=raw;
 if(raw==='true')value=true;else if(raw==='false')value=false;else if(raw!==''&&!Number.isNaN(Number(raw)))value=Number(raw);
 const note=String(document.getElementById('dstateFlagNote')?.value||'');
 if(old&&old.source!=='manual')return alert('derived Flagは直接編集できません。');
 if(old){
  old.scope_type=scopeType;old.scope_id=scopeId;old.key=key;old.value=value;old.note=note;old.updated_at=now();
 }else{
  const r=setFlag(w,scopeType,scopeId,key,value,{source:'manual',note});
  r.row.created_at=r.row.created_at||now();
 }
 emit(w,'FLAG_CHANGED',scopeType,scopeId,{key,value,note,actor:'Human'},{actor:'Human'});
 state.editingFlagId='';
 state.host.saveWorkspace('Development manual flag changed');state.host.refreshWorkspace();render();
}
function deleteManualFlag(id){
 const w=workspace(),row=w.system_flags.find(x=>x.id===id);if(!row||row.source!=='manual')return;
 if(!confirm(`${row.key} を削除しますか？`))return;
 w.system_flags=w.system_flags.filter(x=>x.id!==id);emit(w,'FLAG_CHANGED',row.scope_type,row.scope_id,{key:row.key,deleted:true,actor:'Human'},{actor:'Human'});
 state.host.saveWorkspace('Development manual flag deleted');state.host.refreshWorkspace();render();
}
function renderOverview(w,mount){
 recomputeDerivedFlags(w);
 const nodes=w.system_nodes||[],flags=w.system_flags||[],events=w.system_events||[];
 const ready=nodes.filter(n=>flags.some(f=>f.scope_type==='SystemNode'&&f.scope_id===n.id&&f.key==='SYSTEM_READY'&&f.value===true)).length;
 const pending=nodes.filter(n=>flags.some(f=>f.scope_type==='SystemNode'&&f.scope_id===n.id&&f.key==='CANDIDATE_PENDING'&&f.value===true)).length;
 const invalid=(w.system_connections||[]).filter(c=>flags.some(f=>f.scope_type==='Connection'&&f.scope_id===c.id&&f.key==='CONNECTION_VALID'&&f.value===false)).length;
 mount.innerHTML=`<div class="dstate-tabs"><button class="active">概要</button><button onclick="GKSDevelopmentSystemState.setTab('flags')">Flag</button><button onclick="GKSDevelopmentSystemState.setTab('events')">Event</button></div>
 <div class="dstate-kpis"><div><b>${nodes.length}</b><span>System Node</span></div><div><b>${ready}</b><span>Ready</span></div><div><b>${pending}</b><span>Candidate待ち</span></div><div><b>${invalid}</b><span>接続Error</span></div><div><b>${events.length}</b><span>Event</span></div></div>
 <div class="dstate-grid">${nodes.map(n=>{
  const nf=flags.filter(f=>f.scope_type==='SystemNode'&&f.scope_id===n.id&&f.source==='derived');
  const r=nf.find(f=>f.key==='SYSTEM_READY')?.value===true;
  return `<div class="dstate-card"><div class="dstate-card-head"><b>${esc(n.name||n.id)}</b><span class="badge ${r?'ok':'warn'}">${r?'READY':'WORK'}</span></div><div class="small">${esc(n.id)}</div><div class="dstate-chip-row">${nf.map(f=>`<span class="dstate-chip ${f.value===true?'on':f.value===false?'off':''}" title="${attr(f.note||'')}">${esc(f.key)}=${esc(f.value)}</span>`).join('')}</div></div>`
 }).join('')||'<div class="small">System Nodeがありません。</div>'}</div>`;
}
function renderFlagEditor(w,mount){
 const old=state.editingFlagId==='__NEW__'?null:w.system_flags.find(x=>x.id===state.editingFlagId);
 mount.innerHTML=`<div class="dstate-tabs"><button onclick="GKSDevelopmentSystemState.setTab('overview')">概要</button><button class="active">Flag</button><button onclick="GKSDevelopmentSystemState.setTab('events')">Event</button></div>
 <div class="dstate-editor"><h3>${old?'Manual Flag編集':'Manual Flag追加'}</h3>
 <div class="grid"><div class="field"><label>Scope Type</label><select id="dstateFlagScopeType">${['Project','SystemNode','Connection','Specification','SpecificationCandidate','Category'].map(x=>`<option ${old?.scope_type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Scope ID</label><input id="dstateFlagScopeId" value="${attr(old?.scope_id||'')}"></div></div>
 <div class="grid"><div class="field"><label>Flag Key</label><input id="dstateFlagKey" value="${attr(old?.key||'')}"></div><div class="field"><label>Value</label><input id="dstateFlagValue" value="${attr(old?.value??true)}" placeholder="true / false / number / text"></div></div>
 <div class="field"><label>Note</label><textarea id="dstateFlagNote">${esc(old?.note||'')}</textarea></div>
 <div class="toolbar"><button class="primary" onclick="GKSDevelopmentSystemState.saveManualFlag()">保存</button><button onclick="GKSDevelopmentSystemState.setTab('flags')">キャンセル</button></div></div>`;
}
function renderFlags(w,mount){
 recomputeDerivedFlags(w);
 if(state.editingFlagId)return renderFlagEditor(w,mount);
 const flags=[...(w.system_flags||[])].sort((a,b)=>String(a.scope_type).localeCompare(String(b.scope_type))||String(a.scope_id).localeCompare(String(b.scope_id))||String(a.key).localeCompare(String(b.key)));
 mount.innerHTML=`<div class="dstate-tabs"><button onclick="GKSDevelopmentSystemState.setTab('overview')">概要</button><button class="active">Flag</button><button onclick="GKSDevelopmentSystemState.setTab('events')">Event</button></div>
 <div class="toolbar"><button class="primary" onclick="GKSDevelopmentSystemState.startFlag()">＋ Manual Flag</button><button onclick="GKSDevelopmentSystemState.recomputeAndSave()">Derived再計算</button></div>
 <div class="dstate-table"><div class="dstate-row head"><span>Scope</span><span>Key</span><span>Value</span><span>Source</span><span>更新</span><span></span></div>${flags.map(f=>`<div class="dstate-row"><span>${esc(f.scope_type)} / ${esc(f.scope_id)}</span><span><b>${esc(f.key)}</b><small>${esc(f.note||'')}</small></span><span>${esc(f.value)}</span><span>${esc(f.source||'derived')}</span><span>${esc(f.updated_at||'')}</span><span>${f.source==='manual'?`<button onclick="GKSDevelopmentSystemState.startFlag('${attr(f.id)}')">編集</button> <button class="danger" onclick="GKSDevelopmentSystemState.deleteManualFlag('${attr(f.id)}')">削除</button>`:''}</span></div>`).join('')}</div>`;
}
function renderEvents(w,mount){
 const rows=[...(w.system_events||[])].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 mount.innerHTML=`<div class="dstate-tabs"><button onclick="GKSDevelopmentSystemState.setTab('overview')">概要</button><button onclick="GKSDevelopmentSystemState.setTab('flags')">Flag</button><button class="active">Event</button></div>
 <p class="small">Eventは「何が起きたか」の追跡履歴です。正本DataはNode / Contract / Connection / Specification / Flag側に保持します。</p>
 <div class="dstate-events">${rows.map(e=>`<details class="dstate-event"><summary><b>${esc(eventLabel(e.type))}</b> <span>${esc(targetName(w,e.target_type,e.target_id))}</span><small>${esc(e.created_at)} / ${esc(e.actor)}</small></summary><pre>${esc(JSON.stringify(e.payload||{},null,2))}</pre></details>`).join('')||'<div class="small">Eventはまだありません。</div>'}</div>`;
}
function render(){
 const mount=document.getElementById('devSystemStateMount');if(!mount||!state.host)return;
 const w=workspace();
 if(state.tab==='flags')renderFlags(w,mount);else if(state.tab==='events')renderEvents(w,mount);else renderOverview(w,mount);
}
function recomputeAndSave(){const w=workspace(),changed=recomputeDerivedFlags(w);if(changed.length){emit(w,'FLAG_CHANGED','Project',w.workspace?.id||'',{derived_count:changed.length});state.host.saveWorkspace('Development derived flags recomputed');state.host.refreshWorkspace()}render()}
function init(host){state.host=host;ensure(workspace());render();return api}
const api={init,render,setTab,startFlag,saveManualFlag,deleteManualFlag,recomputeAndSave,ensure,setFlag,emit,recomputeDerivedFlags,recordMutation};
root.GKSDevelopmentSystemState=api;
})(window);
