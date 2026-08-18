/*
 * Development Architecture Explorer
 * Independent Development subsystem for Architecture Node -> Work Box -> Task.
 * No game data, Story editor function, Story DOM, or Story CSS dependency.
 */
(function(global){
  'use strict';

  const state={
    host:null,root:null,
    selectedNodeId:'',selectedBoxId:'',
    nodeEditorMode:'',nodeDraftParent:'',
    boxEditorMode:'',editingTaskId:'',taskEditorOpen:false,
    collapsedNodeIds:new Set(),bound:false
  };
  const TASK_STATUSES=new Set(['Todo','Doing','Blocked','Done']);

  function byId(id){return document.getElementById(id)}
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function attr(value){return esc(value)}
  function workspace(){
    const w=state.host?.getWorkspace?.();
    if(!w)throw new Error('Development Architecture Explorer host is not ready.');
    w.architecture_nodes=Array.isArray(w.architecture_nodes)?w.architecture_nodes:[];
    w.work_boxes=Array.isArray(w.work_boxes)?w.work_boxes:[];
    w.tasks=Array.isArray(w.tasks)?w.tasks:[];
    return w;
  }
  function now(){return state.host?.now?.()||new Date().toISOString()}
  function nextId(prefix,rows){const used=new Set((rows||[]).map(x=>String(x.id||'')));let n=1,id='';do{id=prefix+String(n++).padStart(4,'0')}while(used.has(id));return id}
  function commit(message){if(!state.host?.saveWorkspace?.(message))return false;if(typeof state.host.refreshWorkspace==='function')state.host.refreshWorkspace();else render();return true}
  function nodeById(id){return workspace().architecture_nodes.find(x=>String(x.id)===String(id))||null}
  function boxById(id){return workspace().work_boxes.find(x=>String(x.id)===String(id))||null}
  function childNodes(parentId){return workspace().architecture_nodes.filter(x=>String(x.parent_id||'')===String(parentId||'')).sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id),'ja'))}
  function descendantIds(id){const out=new Set(),stack=[String(id)];while(stack.length){const current=stack.pop();for(const child of childNodes(current)){const cid=String(child.id||'');if(!cid||out.has(cid)||cid===String(id))continue;out.add(cid);stack.push(cid)}}return out}
  function nodePath(id){const w=workspace(),parts=[],seen=new Set();let current=w.architecture_nodes.find(x=>x.id===id);while(current&&!seen.has(current.id)){seen.add(current.id);parts.unshift(current.name||current.id);current=w.architecture_nodes.find(x=>x.id===current.parent_id)}return parts.join(' > ')}
  function boxStatus(boxId){const tasks=workspace().tasks.filter(t=>String(t.box_id)===String(boxId));if(!tasks.length||tasks.every(t=>t.status==='Todo'))return 'Not Started';if(tasks.some(t=>t.status==='Blocked'))return 'Blocked';if(tasks.every(t=>t.status==='Done'))return 'Done';return 'In Progress'}
  function boxStatusLabel(value){return ({'Not Started':'未着手','In Progress':'進行中',Blocked:'Blocked',Done:'完了'})[value]||value}
  function statusClass(value){return value==='Done'?'is-done':value==='Blocked'?'is-blocked':value==='In Progress'||value==='Doing'?'is-doing':''}
  function hide(id,yes=true){byId(id)?.classList.toggle('hidden',!!yes)}

  function clearEditors(){state.nodeEditorMode='';state.nodeDraftParent='';state.boxEditorMode='';state.editingTaskId='';state.taskEditorOpen=false}
  function setNodeSelection(id){state.selectedNodeId=String(id||'');state.selectedBoxId='';clearEditors();render()}
  function setBoxSelection(id){state.selectedBoxId=String(id||'');state.boxEditorMode='';state.editingTaskId='';state.taskEditorOpen=false;render()}

  function populateNodeParentSelect(currentId,parentValue){
    const w=workspace(),parent=byId('daxNodeParent');if(!parent)return;
    const excluded=currentId?descendantIds(currentId):new Set();
    parent.innerHTML='<option value="">（Root）</option>'+w.architecture_nodes
      .filter(x=>x.id!==currentId&&!excluded.has(x.id))
      .sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id),'ja'))
      .map(x=>`<option value="${attr(x.id)}">${esc(nodePath(x.id)||x.name||x.id)} / ${esc(x.id)}</option>`).join('');
    parent.value=parentValue||'';
  }
  function beginNewNode(parentId=''){
    const w=workspace();state.nodeEditorMode='new';state.nodeDraftParent=String(parentId||'');
    byId('daxNodeId').value=nextId('ARCH-',w.architecture_nodes);byId('daxNodeName').value='';populateNodeParentSelect('',state.nodeDraftParent);
    byId('daxNodeEditorTitle').textContent=state.nodeDraftParent?'子Architecture Nodeを追加':'Root Architecture Nodeを追加';
    hide('daxNodeEditorPanel',false);setTimeout(()=>byId('daxNodeName')?.focus(),0);renderVisibilityOnly();
  }
  function beginEditNode(){
    const node=nodeById(state.selectedNodeId);if(!node)return alert('Architecture Nodeを選択してください。');
    state.nodeEditorMode='edit';byId('daxNodeId').value=node.id;byId('daxNodeName').value=node.name||'';populateNodeParentSelect(node.id,node.parent_id||'');
    byId('daxNodeEditorTitle').textContent='Architecture Nodeを編集';hide('daxNodeEditorPanel',false);setTimeout(()=>byId('daxNodeName')?.focus(),0)
  }
  function cancelNodeEdit(){state.nodeEditorMode='';state.nodeDraftParent='';render()}
  function saveNode(){
    const w=workspace(),name=String(byId('daxNodeName')?.value||'').trim();if(!name)return alert('Architecture名を入力してください。');
    const parentId=String(byId('daxNodeParent')?.value||'');
    if(state.nodeEditorMode==='new'){
      const id=String(byId('daxNodeId')?.value||'').trim()||nextId('ARCH-',w.architecture_nodes);if(w.architecture_nodes.some(x=>x.id===id))return alert('同じArchitecture IDが存在します。');
      const stamp=now();w.architecture_nodes.push({id,name,parent_id:parentId,created_at:stamp,updated_at:stamp});if(parentId)state.collapsedNodeIds.delete(parentId);state.selectedNodeId=id;state.selectedBoxId='';state.nodeEditorMode='';state.nodeDraftParent='';commit('Architecture node added');return;
    }
    const node=nodeById(state.selectedNodeId);if(!node)return alert('Architecture Nodeを選択してください。');
    if(parentId===node.id)return alert('自分自身を親にはできません。');if(parentId&&descendantIds(node.id).has(parentId))return alert('子孫Nodeを親にはできません。');
    node.name=name;node.parent_id=parentId;node.updated_at=now();state.nodeEditorMode='';commit('Architecture node updated');
  }
  function deleteNode(){
    const w=workspace(),node=nodeById(state.selectedNodeId);if(!node)return;
    const children=w.architecture_nodes.filter(x=>x.parent_id===node.id),boxes=w.work_boxes.filter(x=>x.node_id===node.id);
    if(children.length||boxes.length)return alert(`このNodeには子Node ${children.length}件 / Work Box ${boxes.length}件があります。先に移動または削除してください。`);
    if(!confirm(`${node.id} / ${node.name} を削除しますか？`))return;w.architecture_nodes=w.architecture_nodes.filter(x=>x.id!==node.id);state.selectedNodeId='';state.selectedBoxId='';clearEditors();commit('Architecture node deleted');
  }
  function toggleNode(id){const key=String(id||'');if(state.collapsedNodeIds.has(key))state.collapsedNodeIds.delete(key);else state.collapsedNodeIds.add(key);renderTree()}
  function expandAll(){state.collapsedNodeIds.clear();renderTree()}
  function collapseAll(){const w=workspace();state.collapsedNodeIds=new Set(w.architecture_nodes.filter(n=>w.architecture_nodes.some(c=>c.parent_id===n.id)).map(n=>String(n.id)));renderTree()}

  function beginNewBox(){
    if(!state.selectedNodeId)return alert('Architecture Nodeを選択してください。');
    const w=workspace();state.selectedBoxId='';state.boxEditorMode='new';state.editingTaskId='';state.taskEditorOpen=false;
    byId('daxBoxId').value=nextId('BOX-',w.work_boxes);byId('daxBoxStatus').value='未着手';byId('daxBoxTitle').value='';byId('daxBoxBody').value='';byId('daxBoxEditorTitle').textContent='Work Boxを追加';hide('daxBoxEditorPanel',false);setTimeout(()=>byId('daxBoxTitle')?.focus(),0);renderVisibilityOnly();
  }
  function beginEditBox(){
    const box=boxById(state.selectedBoxId);if(!box)return alert('Work Boxを選択してください。');state.boxEditorMode='edit';byId('daxBoxId').value=box.id;byId('daxBoxStatus').value=boxStatusLabel(boxStatus(box.id));byId('daxBoxTitle').value=box.title||'';byId('daxBoxBody').value=box.body||'';byId('daxBoxEditorTitle').textContent='Work Boxを編集';hide('daxBoxEditorPanel',false);setTimeout(()=>byId('daxBoxTitle')?.focus(),0)
  }
  function cancelBoxEdit(){state.boxEditorMode='';render()}
  function saveBox(){
    const w=workspace();if(!state.selectedNodeId)return alert('Architecture Nodeを選択してください。');const title=String(byId('daxBoxTitle')?.value||'').trim();if(!title)return alert('Work Boxタイトルを入力してください。');
    let box=state.boxEditorMode==='edit'?boxById(state.selectedBoxId):null;
    if(box){box.title=title;box.body=String(byId('daxBoxBody')?.value||'');box.updated_at=now()}else{const id=String(byId('daxBoxId')?.value||'').trim()||nextId('BOX-',w.work_boxes);if(w.work_boxes.some(x=>x.id===id))return alert('同じWork Box IDが存在します。');box={id,node_id:state.selectedNodeId,title,body:String(byId('daxBoxBody')?.value||''),created_at:now(),updated_at:now()};w.work_boxes.push(box);state.selectedBoxId=id}
    state.boxEditorMode='';commit('Work Box saved');
  }
  function deleteBox(){const w=workspace(),box=boxById(state.selectedBoxId);if(!box)return;const tasks=w.tasks.filter(x=>x.box_id===box.id);if(tasks.length)return alert(`このWork BoxにはTaskが${tasks.length}件あります。先にTaskを削除してください。`);if(!confirm(`${box.id} / ${box.title} を削除しますか？`))return;w.work_boxes=w.work_boxes.filter(x=>x.id!==box.id);state.selectedBoxId='';state.boxEditorMode='';state.editingTaskId='';state.taskEditorOpen=false;commit('Work Box deleted')}

  function beginNewTask(){const box=boxById(state.selectedBoxId);if(!box)return alert('Work Boxを選択してください。');const w=workspace();state.editingTaskId='';state.taskEditorOpen=true;byId('daxTaskId').value=nextId('TASK-',w.tasks);byId('daxTaskTitle').value='';byId('daxTaskStatus').value='Todo';byId('daxTaskEditorTitle').textContent='Taskを追加';hide('daxTaskEditorPanel',false);setTimeout(()=>byId('daxTaskTitle')?.focus(),0)}
  function editTask(id){const t=workspace().tasks.find(x=>x.id===String(id));if(!t)return;state.selectedBoxId=t.box_id;state.editingTaskId=t.id;state.taskEditorOpen=true;byId('daxTaskId').value=t.id;byId('daxTaskTitle').value=t.title;byId('daxTaskStatus').value=TASK_STATUSES.has(t.status)?t.status:'Todo';byId('daxTaskEditorTitle').textContent='Taskを編集';hide('daxTaskEditorPanel',false)}
  function cancelTaskEdit(){state.editingTaskId='';state.taskEditorOpen=false;render()}
  function saveTask(){const w=workspace(),box=boxById(state.selectedBoxId);if(!box)return alert('Work Boxを選択してください。');const title=String(byId('daxTaskTitle')?.value||'').trim();if(!title)return alert('Taskを入力してください。');const status=String(byId('daxTaskStatus')?.value||'Todo');let task=w.tasks.find(x=>x.id===state.editingTaskId);if(task){task.title=title;task.status=TASK_STATUSES.has(status)?status:'Todo';task.updated_at=now()}else{const id=String(byId('daxTaskId')?.value||'').trim()||nextId('TASK-',w.tasks);if(w.tasks.some(x=>x.id===id))return alert('同じTask IDが存在します。');task={id,box_id:box.id,title,status:TASK_STATUSES.has(status)?status:'Todo',created_at:now(),updated_at:now()};w.tasks.push(task)}state.editingTaskId='';state.taskEditorOpen=false;commit('Task saved')}
  function deleteTask(id){const w=workspace(),task=w.tasks.find(x=>x.id===String(id));if(!task)return;if(!confirm(`${task.id} / ${task.title} を削除しますか？`))return;w.tasks=w.tasks.filter(x=>x.id!==task.id);if(state.editingTaskId===task.id){state.editingTaskId='';state.taskEditorOpen=false}commit('Task deleted')}

  function renderTree(){
    const tree=byId('daxTree');if(!tree)return;const w=workspace(),query=String(byId('daxSearch')?.value||'').trim().toLowerCase(),byParent=new Map();
    for(const n of w.architecture_nodes){const key=String(n.parent_id||'');if(!byParent.has(key))byParent.set(key,[]);byParent.get(key).push(n)}for(const rows of byParent.values())rows.sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id),'ja'));
    const directMatch=n=>!query||`${n.id} ${n.name}`.toLowerCase().includes(query);function hasMatch(node,trail=new Set()){const id=String(node.id||'');if(directMatch(node))return true;if(trail.has(id))return false;const next=new Set(trail);next.add(id);return (byParent.get(id)||[]).some(child=>hasMatch(child,next))}
    let html='';const visited=new Set();function walk(parentId,depth){for(const node of byParent.get(String(parentId||''))||[]){const id=String(node.id||'');if(!id||visited.has(id))continue;if(query&&!hasMatch(node))continue;visited.add(id);const children=byParent.get(id)||[],collapsed=state.collapsedNodeIds.has(id)&&!query,active=id===state.selectedNodeId;html+=`<div class="dax-node-row ${active?'is-active':''}" data-dax-action="select-node" data-id="${attr(id)}" style="padding-left:${8+depth*18}px">${children.length?`<button class="dax-node-toggle" type="button" data-dax-action="toggle-node" data-id="${attr(id)}" aria-label="${collapsed?'展開':'折りたたむ'}">${collapsed?'▶':'▼'}</button>`:'<span class="dax-node-spacer"></span>'}<span class="dax-node-label">${esc(node.name||id)}</span><span class="dax-node-id">${esc(id)}</span></div>`;if(!collapsed)walk(id,depth+1)}}walk('',0);for(const node of w.architecture_nodes){if(!visited.has(String(node.id||''))&&(!query||hasMatch(node)))walk(String(node.parent_id||''),0)}tree.innerHTML=html||'<div class="dax-empty">Architecture Nodeはまだありません。</div>';
  }
  function renderBoxList(){const list=byId('daxBoxList');if(!list)return;const w=workspace(),boxes=w.work_boxes.filter(x=>x.node_id===state.selectedNodeId).sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')));list.innerHTML=boxes.map(box=>{const status=boxStatus(box.id),taskCount=w.tasks.filter(t=>t.box_id===box.id).length;return `<div class="dax-box-card ${state.selectedBoxId===box.id?'is-active':''}" data-dax-action="select-box" data-id="${attr(box.id)}"><div class="dax-box-card-head"><b>${esc(box.title)}</b><span class="dax-status ${statusClass(status)}">${esc(boxStatusLabel(status))}</span></div><div class="dax-box-meta">${esc(box.id)} / Task ${taskCount}件 / 更新 ${esc(box.updated_at||'')}</div></div>`}).join('')||'<div class="small">このNodeにはWork Boxがありません。「＋ Work Box」から検討内容を追加できます。</div>';const summary=byId('daxBoxSummary');if(summary)summary.innerHTML=`<span class="dax-status">Box ${boxes.length}件</span><span class="dax-status">Task ${boxes.reduce((n,b)=>n+w.tasks.filter(t=>t.box_id===b.id).length,0)}件</span>`}
  function renderTaskList(){const list=byId('daxTaskList');if(!list)return;const tasks=workspace().tasks.filter(x=>x.box_id===state.selectedBoxId);list.innerHTML=tasks.map(t=>`<div class="dax-task-row"><div class="dax-task-title"><b>${esc(t.title)}</b><div class="dax-view-id">${esc(t.id)}</div></div><span class="dax-status ${statusClass(t.status)}">${esc(t.status)}</span><div class="dax-task-actions"><button type="button" data-dax-action="edit-task" data-id="${attr(t.id)}">編集</button><button class="danger" type="button" data-dax-action="delete-task" data-id="${attr(t.id)}">削除</button></div></div>`).join('')||'<div class="small">Taskはまだありません。</div>'}

  function renderVisibilityOnly(){
    const node=nodeById(state.selectedNodeId),hasNode=!!node,newNode=state.nodeEditorMode==='new';
    hide('daxNodeView',!hasNode);hide('daxNodeEditorPanel',!state.nodeEditorMode);hide('daxNodeDependent',!hasNode);
    const box=boxById(state.selectedBoxId);hide('daxBoxView',!box);hide('daxBoxEditorPanel',!state.boxEditorMode);hide('daxTaskEditorPanel',!state.taskEditorOpen);
    if(newNode){hide('daxNodeView',true);hide('daxNodeDependent',true)}
  }
  function render(){
    if(!state.root)return;const w=workspace();
    if(state.selectedNodeId&&!w.architecture_nodes.some(x=>x.id===state.selectedNodeId)){state.selectedNodeId='';state.selectedBoxId='';clearEditors()}
    if(state.selectedBoxId&&!w.work_boxes.some(x=>x.id===state.selectedBoxId&&x.node_id===state.selectedNodeId)){state.selectedBoxId='';state.boxEditorMode='';state.editingTaskId='';state.taskEditorOpen=false}
    renderTree();const empty=byId('daxEmpty'),editor=byId('daxEditor'),node=nodeById(state.selectedNodeId),isNewNode=state.nodeEditorMode==='new';if(!empty||!editor)return;
    if(!node&&!isNewNode){empty.classList.remove('hidden');editor.classList.add('hidden');return}empty.classList.add('hidden');editor.classList.remove('hidden');
    if(node){byId('daxNodeViewName').textContent=node.name||node.id;byId('daxNodeViewId').textContent=node.id;byId('daxNodePath').textContent=nodePath(node.id);renderBoxList();const box=boxById(state.selectedBoxId);if(box){byId('daxBoxViewId').textContent=box.id;byId('daxBoxViewTitle').textContent=box.title||box.id;const status=boxStatus(box.id);byId('daxBoxViewStatus').innerHTML=`<span class="dax-status ${statusClass(status)}">${esc(boxStatusLabel(status))}</span>`;byId('daxBoxViewBody').textContent=box.body||'本文なし';renderTaskList()}}
    if(state.nodeEditorMode==='edit'&&node){byId('daxNodeId').value=node.id;byId('daxNodeName').value=node.name||'';populateNodeParentSelect(node.id,node.parent_id||'')}
    if(state.boxEditorMode==='edit'){const box=boxById(state.selectedBoxId);if(box){byId('daxBoxId').value=box.id;byId('daxBoxStatus').value=boxStatusLabel(boxStatus(box.id));byId('daxBoxTitle').value=box.title||'';byId('daxBoxBody').value=box.body||''}}
    renderVisibilityOnly();
  }

  function handleAction(action,id,event){switch(action){case 'root-add':beginNewNode('');break;case 'child-add':if(!state.selectedNodeId)return alert('親にするArchitecture Nodeを選択してください。');beginNewNode(state.selectedNodeId);break;case 'edit-node':beginEditNode();break;case 'cancel-node-edit':cancelNodeEdit();break;case 'expand-all':expandAll();break;case 'collapse-all':collapseAll();break;case 'select-node':setNodeSelection(id);break;case 'toggle-node':event?.stopPropagation();toggleNode(id);break;case 'save-node':saveNode();break;case 'delete-node':deleteNode();break;case 'new-box':beginNewBox();break;case 'select-box':setBoxSelection(id);break;case 'edit-box':beginEditBox();break;case 'cancel-box-edit':cancelBoxEdit();break;case 'save-box':saveBox();break;case 'delete-box':deleteBox();break;case 'new-task':beginNewTask();break;case 'edit-task':editTask(id);break;case 'cancel-task-edit':cancelTaskEdit();break;case 'save-task':saveTask();break;case 'delete-task':deleteTask(id);break}}
  function bind(){if(state.bound||!state.root)return;state.root.addEventListener('click',event=>{const target=event.target.closest('[data-dax-action]');if(!target||!state.root.contains(target))return;handleAction(target.dataset.daxAction,target.dataset.id||'',event)});byId('daxSearch')?.addEventListener('input',renderTree);state.bound=true}
  function focus(nodeId,boxId=''){state.selectedNodeId=String(nodeId||'');state.selectedBoxId=String(boxId||'');clearEditors();if(state.selectedNodeId){let p=nodeById(state.selectedNodeId)?.parent_id;while(p){state.collapsedNodeIds.delete(String(p));p=nodeById(p)?.parent_id}}render()}
  function init(host){if(!host||typeof host.getWorkspace!=='function'||typeof host.saveWorkspace!=='function')throw new Error('Development Architecture Explorer host API is invalid.');state.host=host;state.root=byId('developmentPane-architecture');bind();render();return api}
  const api={init,render,focus};global.GKSDevelopmentArchitectureExplorer=api;
})(window);
