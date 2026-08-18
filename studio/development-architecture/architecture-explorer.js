/*
 * Development Architecture Explorer
 * Independent Development subsystem for Architecture Node -> Work Box -> Task.
 * No game data, Story editor function, Story DOM, or Story CSS dependency.
 */
(function(global){
  'use strict';

  const state={
    host:null,
    root:null,
    selectedNodeId:'',
    selectedBoxId:'',
    editingTaskId:'',
    collapsedNodeIds:new Set(),
    bound:false
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
  function nextId(prefix,rows){
    const used=new Set((rows||[]).map(x=>String(x.id||'')));
    let n=1,id='';
    do{id=prefix+String(n++).padStart(4,'0')}while(used.has(id));
    return id;
  }
  function commit(message){
    if(!state.host?.saveWorkspace?.(message))return false;
    if(typeof state.host.refreshWorkspace==='function')state.host.refreshWorkspace();
    else render();
    return true;
  }
  function nodeById(id){return workspace().architecture_nodes.find(x=>String(x.id)===String(id))||null}
  function childNodes(parentId){
    return workspace().architecture_nodes
      .filter(x=>String(x.parent_id||'')===String(parentId||''))
      .sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id),'ja'));
  }
  function descendantIds(id){
    const out=new Set(),stack=[String(id)];
    while(stack.length){
      const current=stack.pop();
      for(const child of childNodes(current)){
        const childId=String(child.id||'');
        if(!childId||out.has(childId)||childId===String(id))continue;
        out.add(childId);stack.push(childId);
      }
    }
    return out;
  }
  function boxStatus(boxId){
    const tasks=workspace().tasks.filter(t=>String(t.box_id)===String(boxId));
    if(!tasks.length||tasks.every(t=>t.status==='Todo'))return 'Not Started';
    if(tasks.some(t=>t.status==='Blocked'))return 'Blocked';
    if(tasks.every(t=>t.status==='Done'))return 'Done';
    return 'In Progress';
  }
  function boxStatusLabel(value){return ({'Not Started':'未着手','In Progress':'進行中',Blocked:'Blocked',Done:'完了'})[value]||value}
  function statusClass(value){return value==='Done'?'is-done':value==='Blocked'?'is-blocked':value==='In Progress'||value==='Doing'?'is-doing':''}

  function setNodeSelection(id){
    state.selectedNodeId=String(id||'');
    state.selectedBoxId='';
    state.editingTaskId='';
    render();
  }
  function setBoxSelection(id){
    state.selectedBoxId=String(id||'');
    state.editingTaskId='';
    render();
  }

  function createRoot(){
    const w=workspace(),stamp=now(),id=nextId('ARCH-',w.architecture_nodes);
    w.architecture_nodes.push({id,name:'新しいArchitecture',parent_id:'',created_at:stamp,updated_at:stamp});
    state.selectedNodeId=id;state.selectedBoxId='';state.editingTaskId='';
    commit('Architecture root added');
    setTimeout(()=>byId('daxNodeName')?.select(),0);
  }
  function createChild(){
    const w=workspace();
    if(!state.selectedNodeId)return alert('親にするArchitecture Nodeを選択してください。');
    const stamp=now(),id=nextId('ARCH-',w.architecture_nodes);
    w.architecture_nodes.push({id,name:'新しいArchitecture',parent_id:state.selectedNodeId,created_at:stamp,updated_at:stamp});
    state.collapsedNodeIds.delete(state.selectedNodeId);
    state.selectedNodeId=id;state.selectedBoxId='';state.editingTaskId='';
    commit('Architecture child added');
    setTimeout(()=>byId('daxNodeName')?.select(),0);
  }
  function saveNode(){
    const w=workspace(),node=w.architecture_nodes.find(x=>x.id===state.selectedNodeId);
    if(!node)return alert('Architecture Nodeを選択してください。');
    const name=String(byId('daxNodeName')?.value||'').trim();
    if(!name)return alert('Architecture名を入力してください。');
    const parentId=String(byId('daxNodeParent')?.value||'');
    if(parentId===node.id)return alert('自分自身を親にはできません。');
    if(parentId&&descendantIds(node.id).has(parentId))return alert('子孫Nodeを親にはできません。');
    node.name=name;node.parent_id=parentId;node.updated_at=now();
    commit('Architecture node updated');
  }
  function deleteNode(){
    const w=workspace(),node=w.architecture_nodes.find(x=>x.id===state.selectedNodeId);
    if(!node)return;
    const children=w.architecture_nodes.filter(x=>x.parent_id===node.id),boxes=w.work_boxes.filter(x=>x.node_id===node.id);
    if(children.length||boxes.length)return alert(`このNodeには子Node ${children.length}件 / Work Box ${boxes.length}件があります。先に移動または削除してください。`);
    if(!confirm(`${node.id} / ${node.name} を削除しますか？`))return;
    w.architecture_nodes=w.architecture_nodes.filter(x=>x.id!==node.id);
    state.selectedNodeId='';state.selectedBoxId='';state.editingTaskId='';
    commit('Architecture node deleted');
  }
  function toggleNode(id){
    const key=String(id||'');
    if(state.collapsedNodeIds.has(key))state.collapsedNodeIds.delete(key);else state.collapsedNodeIds.add(key);
    renderTree();
  }
  function expandAll(){state.collapsedNodeIds.clear();renderTree()}
  function collapseAll(){
    const w=workspace();
    state.collapsedNodeIds=new Set(w.architecture_nodes.filter(n=>w.architecture_nodes.some(c=>c.parent_id===n.id)).map(n=>String(n.id)));
    renderTree();
  }

  function resetBoxEditor(){
    state.selectedBoxId='';state.editingTaskId='';
    const w=workspace();
    if(byId('daxBoxId'))byId('daxBoxId').value=nextId('BOX-',w.work_boxes);
    if(byId('daxBoxTitle'))byId('daxBoxTitle').value='';
    if(byId('daxBoxBody'))byId('daxBoxBody').value='';
    if(byId('daxBoxStatus'))byId('daxBoxStatus').value='未着手';
    byId('daxTaskSection')?.classList.add('hidden');
    renderBoxList();
  }
  function saveBox(){
    const w=workspace();
    if(!state.selectedNodeId)return alert('Architecture Nodeを選択してください。');
    const title=String(byId('daxBoxTitle')?.value||'').trim();
    if(!title)return alert('Work Boxタイトルを入力してください。');
    let box=w.work_boxes.find(x=>x.id===state.selectedBoxId);
    if(box){
      box.title=title;box.body=String(byId('daxBoxBody')?.value||'');box.updated_at=now();
    }else{
      const id=String(byId('daxBoxId')?.value||'').trim()||nextId('BOX-',w.work_boxes);
      if(w.work_boxes.some(x=>x.id===id))return alert('同じWork Box IDが存在します。');
      box={id,node_id:state.selectedNodeId,title,body:String(byId('daxBoxBody')?.value||''),created_at:now(),updated_at:now()};
      w.work_boxes.push(box);state.selectedBoxId=id;
    }
    commit('Work Box saved');
  }
  function deleteBox(){
    const w=workspace(),box=w.work_boxes.find(x=>x.id===state.selectedBoxId);
    if(!box)return;
    const tasks=w.tasks.filter(x=>x.box_id===box.id);
    if(tasks.length)return alert(`このWork BoxにはTaskが${tasks.length}件あります。先にTaskを削除してください。`);
    if(!confirm(`${box.id} / ${box.title} を削除しますか？`))return;
    w.work_boxes=w.work_boxes.filter(x=>x.id!==box.id);state.selectedBoxId='';state.editingTaskId='';
    commit('Work Box deleted');
  }

  function resetTaskEditor(){
    state.editingTaskId='';
    const w=workspace();
    if(byId('daxTaskId'))byId('daxTaskId').value=nextId('TASK-',w.tasks);
    if(byId('daxTaskTitle'))byId('daxTaskTitle').value='';
    if(byId('daxTaskStatus'))byId('daxTaskStatus').value='Todo';
  }
  function editTask(id){
    const t=workspace().tasks.find(x=>x.id===String(id));
    if(!t)return;
    state.selectedBoxId=t.box_id;state.editingTaskId=t.id;
    if(byId('daxTaskId'))byId('daxTaskId').value=t.id;
    if(byId('daxTaskTitle'))byId('daxTaskTitle').value=t.title;
    if(byId('daxTaskStatus'))byId('daxTaskStatus').value=TASK_STATUSES.has(t.status)?t.status:'Todo';
  }
  function saveTask(){
    const w=workspace(),box=w.work_boxes.find(x=>x.id===state.selectedBoxId);
    if(!box)return alert('Work Boxを選択してください。');
    const title=String(byId('daxTaskTitle')?.value||'').trim();
    if(!title)return alert('Taskを入力してください。');
    const status=String(byId('daxTaskStatus')?.value||'Todo');
    let task=w.tasks.find(x=>x.id===state.editingTaskId);
    if(task){
      task.title=title;task.status=TASK_STATUSES.has(status)?status:'Todo';task.updated_at=now();
    }else{
      const id=String(byId('daxTaskId')?.value||'').trim()||nextId('TASK-',w.tasks);
      if(w.tasks.some(x=>x.id===id))return alert('同じTask IDが存在します。');
      task={id,box_id:box.id,title,status:TASK_STATUSES.has(status)?status:'Todo',created_at:now(),updated_at:now()};
      w.tasks.push(task);
    }
    state.editingTaskId='';
    commit('Task saved');
  }
  function deleteTask(id){
    const w=workspace(),task=w.tasks.find(x=>x.id===String(id));
    if(!task)return;
    if(!confirm(`${task.id} / ${task.title} を削除しますか？`))return;
    w.tasks=w.tasks.filter(x=>x.id!==task.id);
    if(state.editingTaskId===task.id)state.editingTaskId='';
    commit('Task deleted');
  }

  function renderTree(){
    const tree=byId('daxTree');if(!tree)return;
    const w=workspace(),query=String(byId('daxSearch')?.value||'').trim().toLowerCase();
    const byParent=new Map();
    for(const n of w.architecture_nodes){
      const key=String(n.parent_id||'');
      if(!byParent.has(key))byParent.set(key,[]);
      byParent.get(key).push(n);
    }
    for(const rows of byParent.values())rows.sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id),'ja'));
    const directMatch=n=>!query||`${n.id} ${n.name}`.toLowerCase().includes(query);
    function hasMatch(node,trail=new Set()){
      const id=String(node.id||'');
      if(directMatch(node))return true;
      if(trail.has(id))return false;
      const next=new Set(trail);next.add(id);
      return (byParent.get(id)||[]).some(child=>hasMatch(child,next));
    }
    let html='';const visited=new Set();
    function walk(parentId,depth){
      for(const node of byParent.get(String(parentId||''))||[]){
        const id=String(node.id||'');
        if(!id||visited.has(id))continue;
        if(query&&!hasMatch(node))continue;
        visited.add(id);
        const children=byParent.get(id)||[],collapsed=state.collapsedNodeIds.has(id)&&!query,active=id===state.selectedNodeId;
        html+=`<div class="dax-node-row ${active?'is-active':''}" data-dax-action="select-node" data-id="${attr(id)}" style="padding-left:${8+depth*18}px">`+
          (children.length?`<button class="dax-node-toggle" type="button" data-dax-action="toggle-node" data-id="${attr(id)}" aria-label="${collapsed?'展開':'折りたたむ'}">${collapsed?'▶':'▼'}</button>`:'<span class="dax-node-spacer"></span>')+
          `<span class="dax-node-label">${esc(node.name||id)}</span><span class="dax-node-id">${esc(id)}</span></div>`;
        if(!collapsed)walk(id,depth+1);
      }
    }
    walk('',0);
    // Imported malformed/orphan/cyclic records remain visible instead of disappearing.
    for(const node of w.architecture_nodes){if(!visited.has(String(node.id||''))&&(!query||hasMatch(node)))walk(String(node.parent_id||''),0)}
    tree.innerHTML=html||'<div class="dax-empty">Architecture Nodeはまだありません。</div>';
  }

  function renderBoxList(){
    const list=byId('daxBoxList');if(!list)return;
    const w=workspace(),boxes=w.work_boxes.filter(x=>x.node_id===state.selectedNodeId).sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
    list.innerHTML=boxes.map(box=>{
      const status=boxStatus(box.id),taskCount=w.tasks.filter(t=>t.box_id===box.id).length;
      return `<div class="dax-box-card ${state.selectedBoxId===box.id?'is-active':''}" data-dax-action="select-box" data-id="${attr(box.id)}"><b>${esc(box.id)} / ${esc(box.title)}</b> <span class="dax-status ${statusClass(status)}">${esc(boxStatusLabel(status))}</span><div class="dax-box-meta">Task ${taskCount}件 / 更新 ${esc(box.updated_at||'')}</div></div>`;
    }).join('')||'<div class="small">このNodeにはWork Boxがありません。</div>';
    const summary=byId('daxBoxSummary');
    if(summary)summary.innerHTML=`<span class="dax-status">Box ${boxes.length}件</span><span class="dax-status">Task ${boxes.reduce((n,b)=>n+w.tasks.filter(t=>t.box_id===b.id).length,0)}件</span>`;
  }

  function renderTaskList(){
    const list=byId('daxTaskList');if(!list)return;
    const tasks=workspace().tasks.filter(x=>x.box_id===state.selectedBoxId);
    list.innerHTML=tasks.map(t=>`<div class="dax-task-row"><div class="dax-task-title"><b>${esc(t.id)}</b> ${esc(t.title)}</div><span class="dax-status ${statusClass(t.status)}">${esc(t.status)}</span><div class="dax-task-actions"><button type="button" data-dax-action="edit-task" data-id="${attr(t.id)}">編集</button><button class="danger" type="button" data-dax-action="delete-task" data-id="${attr(t.id)}">削除</button></div></div>`).join('')||'<div class="small">Taskはまだありません。</div>';
  }

  function render(){
    if(!state.root)return;
    const w=workspace();
    if(state.selectedNodeId&&!w.architecture_nodes.some(x=>x.id===state.selectedNodeId)){state.selectedNodeId='';state.selectedBoxId='';state.editingTaskId=''}
    if(state.selectedBoxId&&!w.work_boxes.some(x=>x.id===state.selectedBoxId&&x.node_id===state.selectedNodeId)){state.selectedBoxId='';state.editingTaskId=''}
    renderTree();
    const empty=byId('daxEmpty'),editor=byId('daxEditor'),node=nodeById(state.selectedNodeId);
    if(!empty||!editor)return;
    if(!node){empty.classList.remove('hidden');editor.classList.add('hidden');return}
    empty.classList.add('hidden');editor.classList.remove('hidden');
    byId('daxNodeId').value=node.id;
    byId('daxNodeName').value=node.name||'';
    const descendants=descendantIds(node.id),parent=byId('daxNodeParent');
    parent.innerHTML='<option value="">（Root）</option>'+w.architecture_nodes
      .filter(x=>x.id!==node.id&&!descendants.has(x.id))
      .sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id),'ja'))
      .map(x=>`<option value="${attr(x.id)}">${esc(x.name||x.id)} / ${esc(x.id)}</option>`).join('');
    parent.value=node.parent_id||'';
    renderBoxList();
    const box=w.work_boxes.find(x=>x.id===state.selectedBoxId&&x.node_id===node.id);
    if(box){
      byId('daxBoxId').value=box.id;byId('daxBoxTitle').value=box.title||'';byId('daxBoxBody').value=box.body||'';byId('daxBoxStatus').value=boxStatusLabel(boxStatus(box.id));
      byId('daxTaskSection')?.classList.remove('hidden');renderTaskList();
      if(state.editingTaskId){editTask(state.editingTaskId)}else resetTaskEditor();
    }else{
      state.selectedBoxId='';state.editingTaskId='';
      if(byId('daxBoxId'))byId('daxBoxId').value=nextId('BOX-',w.work_boxes);
      if(byId('daxBoxTitle'))byId('daxBoxTitle').value='';
      if(byId('daxBoxBody'))byId('daxBoxBody').value='';
      if(byId('daxBoxStatus'))byId('daxBoxStatus').value='未着手';
      byId('daxTaskSection')?.classList.add('hidden');
    }
  }

  function handleAction(action,id,event){
    switch(action){
      case 'root-add':createRoot();break;
      case 'child-add':createChild();break;
      case 'expand-all':expandAll();break;
      case 'collapse-all':collapseAll();break;
      case 'select-node':setNodeSelection(id);break;
      case 'toggle-node':event?.stopPropagation();toggleNode(id);break;
      case 'save-node':saveNode();break;
      case 'delete-node':deleteNode();break;
      case 'new-box':resetBoxEditor();break;
      case 'select-box':setBoxSelection(id);break;
      case 'save-box':saveBox();break;
      case 'delete-box':deleteBox();break;
      case 'new-task':resetTaskEditor();break;
      case 'edit-task':editTask(id);break;
      case 'save-task':saveTask();break;
      case 'delete-task':deleteTask(id);break;
    }
  }

  function bind(){
    if(state.bound||!state.root)return;
    state.root.addEventListener('click',event=>{
      const target=event.target.closest('[data-dax-action]');
      if(!target||!state.root.contains(target))return;
      handleAction(target.dataset.daxAction,target.dataset.id||'',event);
    });
    byId('daxSearch')?.addEventListener('input',renderTree);
    state.bound=true;
  }

  function init(host){
    if(!host||typeof host.getWorkspace!=='function'||typeof host.saveWorkspace!=='function')throw new Error('Development Architecture Explorer host API is invalid.');
    state.host=host;state.root=byId('developmentPane-architecture');bind();render();
    return api;
  }

  const api={init,render};
  global.GKSDevelopmentArchitectureExplorer=api;
})(window);
