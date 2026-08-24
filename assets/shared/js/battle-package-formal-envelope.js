(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.GKSBattleFormalEnvelope=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const HEX64=/^[0-9a-f]{64}$/i;
  const CANDIDATE_TYPES=Object.freeze([
    'unit_snapshot','character','job','equipment','skill','passive','mod','ai_program','ai_master_snapshot','monster','enemy_snapshot'
  ]);
  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
  function canonicalize(value){
    if(Array.isArray(value))return value.map(canonicalize);
    if(value&&typeof value==='object'){
      const out={};
      Object.keys(value).sort().forEach(key=>{if(value[key]!==undefined)out[key]=canonicalize(value[key]);});
      return out;
    }
    return value;
  }
  function canonicalStringify(value){return JSON.stringify(canonicalize(value));}
  function requiredString(value,label){const s=String(value==null?'':value).trim();if(!s)throw new Error(label+'が必要です。');return s;}
  function requiredHash(value,label){const s=requiredString(value,label).toLowerCase();if(!HEX64.test(s))throw new Error(label+'はSHA-256 hex 64文字で指定してください。');return s;}
  function isFormalManifest(manifest){return !!(manifest&&manifest.formal&&manifest.formal.mode==='formal');}
  function validateFormalManifest(manifest){
    if(!isFormalManifest(manifest))return {formal:false};
    const b=manifest.formal.bindings;
    if(!b||typeof b!=='object'||Array.isArray(b))throw new Error('formal.bindingsが必要です。');
    const source=b.source||{},data=b.data||{},formula=b.formula||{},rules=b.rules_config||{};
    requiredString(source.game_build,'formal.bindings.source.game_build');
    requiredString(source.studio_build,'formal.bindings.source.studio_build');
    requiredHash(source.package_manifest_sha256,'formal.bindings.source.package_manifest_sha256');
    requiredString(data.project_id,'formal.bindings.data.project_id');
    requiredString(data.data_version,'formal.bindings.data.data_version');
    requiredHash(data.snapshot_sha256,'formal.bindings.data.snapshot_sha256');
    requiredString(formula.version,'formal.bindings.formula.version');
    requiredHash(formula.snapshot_sha256,'formal.bindings.formula.snapshot_sha256');
    if(!Array.isArray(rules.files)||rules.files.length===0)throw new Error('formal.bindings.rules_config.filesは1件以上必要です。');
    const seen=new Set();
    rules.files.forEach((item,index)=>{
      if(!item||typeof item!=='object'||Array.isArray(item))throw new Error(`formal.bindings.rules_config.files[${index}]が不正です。`);
      const path=requiredString(item.path,`formal.bindings.rules_config.files[${index}].path`);
      if(seen.has(path))throw new Error(`formal.bindings.rules_config.files.pathが重複しています: ${path}`);
      seen.add(path);requiredHash(item.sha256,`formal.bindings.rules_config.files[${index}].sha256`);
    });
    return {formal:true,bindings:clone(b)};
  }
  function compareBindings(expected,actual){
    const mismatches=[];
    function cmp(path,a,b){if(String(a??'')!==String(b??''))mismatches.push({path,expected:a??null,actual:b??null});}
    const es=expected?.source||{},as=actual?.source||{};
    cmp('source.game_build',es.game_build,as.game_build);
    cmp('source.studio_build',es.studio_build,as.studio_build);
    cmp('source.package_manifest_sha256',String(es.package_manifest_sha256||'').toLowerCase(),String(as.package_manifest_sha256||'').toLowerCase());
    const ed=expected?.data||{},ad=actual?.data||{};
    cmp('data.project_id',ed.project_id,ad.project_id);
    cmp('data.data_version',ed.data_version,ad.data_version);
    cmp('data.snapshot_sha256',String(ed.snapshot_sha256||'').toLowerCase(),String(ad.snapshot_sha256||'').toLowerCase());
    const ef=expected?.formula||{},af=actual?.formula||{};
    cmp('formula.version',ef.version,af.version);
    cmp('formula.snapshot_sha256',String(ef.snapshot_sha256||'').toLowerCase(),String(af.snapshot_sha256||'').toLowerCase());
    const actualFiles=new Map((actual?.rules_config?.files||[]).map(x=>[String(x.path||''),String(x.sha256||'').toLowerCase()]));
    for(const item of expected?.rules_config?.files||[]){
      const path=String(item.path||''),expectedHash=String(item.sha256||'').toLowerCase();
      if(!actualFiles.has(path))mismatches.push({path:`rules_config.files.${path}`,expected:expectedHash,actual:null});
      else cmp(`rules_config.files.${path}`,expectedHash,actualFiles.get(path));
    }
    return mismatches;
  }
  function validateAiMasterSnapshotData(data){
    if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('ai_master_snapshot dataはオブジェクトが必要です。');
    requiredString(data.id,'ai_master_snapshot.data.id');
    requiredString(data.version,'ai_master_snapshot.data.version');
    requiredString(data.data_version,'ai_master_snapshot.data.data_version');
    if(!Array.isArray(data.nodes)||data.nodes.length===0)throw new Error('ai_master_snapshot.data.nodesは1件以上必要です。');
    const seen=new Set(),allowedTypes=new Set(['condition','target','action']);
    data.nodes.forEach((node,index)=>{
      if(!node||typeof node!=='object'||Array.isArray(node))throw new Error(`ai_master_snapshot.data.nodes[${index}]が不正です。`);
      const id=requiredString(node.id,`ai_master_snapshot.data.nodes[${index}].id`);
      if(seen.has(id))throw new Error(`ai_master_snapshot.data.nodes.idが重複しています: ${id}`);
      seen.add(id);
      const type=requiredString(node.node_type,`ai_master_snapshot.data.nodes[${index}].node_type`);
      if(!allowedTypes.has(type))throw new Error(`ai_master_snapshot.data.nodes[${index}].node_typeが未対応です: ${type}`);
      requiredString(node.name,`ai_master_snapshot.data.nodes[${index}].name`);
      requiredString(node.status,`ai_master_snapshot.data.nodes[${index}].status`);
      requiredString(node.data_version,`ai_master_snapshot.data.nodes[${index}].data_version`);
      requiredString(node.evaluator,`ai_master_snapshot.data.nodes[${index}].evaluator`);
      if(!node.ports||typeof node.ports!=='object'||Array.isArray(node.ports))throw new Error(`ai_master_snapshot.data.nodes[${index}].portsが必要です。`);
      if(!node.parameter_schema||typeof node.parameter_schema!=='object'||Array.isArray(node.parameter_schema)||node.parameter_schema.type!=='object')throw new Error(`ai_master_snapshot.data.nodes[${index}].parameter_schemaはobject Schemaが必要です。`);
    });
    return clone(data);
  }
  function validateCandidateEnvelope(doc){
    if(!doc||typeof doc!=='object'||Array.isArray(doc))throw new Error('Candidate resourceの最上位はオブジェクトにしてください。');
    if(doc.format!=='guild-adventure-studio-battle-candidate')throw new Error('Candidate resource formatが不正です。');
    if(String(doc.version||'')!=='1.0.0')throw new Error('Candidate resource versionは1.0.0が必要です。');
    const candidateType=requiredString(doc.candidate_type,'candidate_type');
    if(!CANDIDATE_TYPES.includes(candidateType))throw new Error('未対応candidate_typeです: '+candidateType);
    const candidateId=requiredString(doc.candidate_id,'candidate_id');
    const provenance=doc.provenance;
    if(!provenance||typeof provenance!=='object'||Array.isArray(provenance))throw new Error('provenanceが必要です。');
    ['owner','owner_id','source_type','source_id','version'].forEach(k=>requiredString(provenance[k],`provenance.${k}`));
    const payloadSha256=requiredHash(doc.payload_sha256,'payload_sha256');
    if(!doc.data||typeof doc.data!=='object'||Array.isArray(doc.data))throw new Error('Candidate resource dataオブジェクトが必要です。');
    const data=candidateType==='ai_master_snapshot'?validateAiMasterSnapshotData(doc.data):clone(doc.data);
    return {candidate_type:candidateType,candidate_id:candidateId,provenance:clone(provenance),payload_sha256:payloadSha256,data};
  }
  function validateFormalRoster(payload){
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Formal roster dataが不正です。');
    if(String(payload.mode||'')!=='formal')throw new Error('Formal Battle Packageのbattle-rosterにはmode="formal"が必要です。');
    const snap=payload.formal_snapshot;
    if(!snap||typeof snap!=='object'||Array.isArray(snap))throw new Error('battle-roster.formal_snapshotが必要です。');
    ['snapshot_id','version','owner'].forEach(k=>requiredString(snap[k],`battle-roster.formal_snapshot.${k}`));
    for(const [label,entries] of [['allies',payload.allies],['enemies',payload.enemies]]){
      if(!Array.isArray(entries))throw new Error(`battle-roster.${label}は配列が必要です。`);
      entries.forEach((entry,index)=>{
        if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error(`battle-roster.${label}[${index}]が不正です。`);
        const count=Number(entry.count==null?1:entry.count);
        if(!Number.isInteger(count)||count<1)throw new Error(`battle-roster.${label}[${index}].countは1以上の整数にしてください。`);
        if(entry.unit||entry.master_id||entry.id||entry.overrides)throw new Error(`Formal roster ${label}[${index}]はraw unit/master/overrideを使用できません。snapshot_refを使用してください。`);
        const ref=entry.snapshot_ref;
        if(!ref||typeof ref!=='object'||Array.isArray(ref))throw new Error(`Formal roster ${label}[${index}].snapshot_refが必要です。`);
        requiredString(ref.candidate_id,`Formal roster ${label}[${index}].snapshot_ref.candidate_id`);
        if(String(ref.candidate_type||'')!=='unit_snapshot')throw new Error(`Formal roster ${label}[${index}]はcandidate_type=unit_snapshotのみ参照できます。`);
      });
    }
    return clone(payload);
  }
  return Object.freeze({CANDIDATE_TYPES,canonicalize,canonicalStringify,isFormalManifest,validateFormalManifest,compareBindings,validateAiMasterSnapshotData,validateCandidateEnvelope,validateFormalRoster});
});
