(function(){
'use strict';
const te=new TextEncoder();
const AI_GATEWAY_MANIFEST_URL='../ai-gateway-manifest.json';
async function loadGovernanceExportFiles(){
 const manifestResponse=await fetch(AI_GATEWAY_MANIFEST_URL,{cache:'no-store'});
 if(!manifestResponse.ok)throw new Error('AI Gateway manifestを取得できません: '+manifestResponse.status);
 const manifest=await manifestResponse.json();
 const paths=[manifest.aiSemanticEntrypoint,...(manifest.gatewayMachinePreloadFiles||[]),...(manifest.conditionalGovernanceFiles||[]),...(manifest.conditionalMachinePolicyFiles||[])].filter(Boolean);
 const unique=[...new Set(paths)];
 const files=[];
 for(const path of unique){
  if(!(manifest.allowedFiles||[]).includes(path))throw new Error('AI用引き継ぎ対象がallowlist外です: '+path);
  const response=await fetch('../'+path,{cache:'no-store'});
  if(!response.ok)throw new Error('AI用引き継ぎファイルを取得できません: '+path+' ('+response.status+')');
  const content=await response.text();
  if(!content.trim())throw new Error('AI用引き継ぎファイルが空です: '+path);
  files.push({name:'governance/'+path,data:content});
 }
 return files;
}

function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function u16(n){return [n&255,(n>>>8)&255]}function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]}
function zipStore(files){const UTF8_FLAG=0x0800;let out=[],central=[],offset=0;for(const f of files){const normalizedName=String(f.name||'').normalize('NFC');const name=te.encode(normalizedName),body=typeof f.data==='string'?te.encode(f.data):f.data,crc=crc32(body);const local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(UTF8_FLAG),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(body.length),...u32(body.length),...u16(name.length),...u16(0),...name]);out.push(local,body);central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(UTF8_FLAG),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(body.length),...u32(body.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]));offset+=local.length+body.length;}const csize=central.reduce((n,x)=>n+x.length,0),eocd=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(csize),...u32(offset),...u16(0)]);return new Blob([...out,...central,eocd],{type:'application/zip'});}
function saveBlob(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);}
function safeJson(v){try{return JSON.stringify(v,null,2)}catch(e){return JSON.stringify({error:e.message},null,2)}}
function guideMd(){const g=window.GK_VERIFICATION_GUIDES||{};return Object.entries(g).map(([id,x])=>`# ${x.title}\n\n${x.summary}\n\n## 手順\n${x.steps.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\n## ポイント\n${x.tips.map(s=>`- ${s}`).join('\n')}\n`).join('\n---\n\n');}
function collect(){const project=typeof data!=='undefined'?data:null,cards=typeof designCards!=='undefined'?designCards:[];return {project,cards,meta:{schema:'gk-ai-project-package',version:'1.0.0',generated_at:new Date().toISOString(),studio_version:typeof APP_VERSION!=='undefined'?APP_VERSION:'unknown',project_id:typeof currentProjectId!=='undefined'?currentProjectId:'unknown'}};}
window.exportProjectForAI=async function(){try{const p=collect(),name=(p.project?.project?.id||p.meta.project_id||'project').replace(/[^A-Za-z0-9_.-]/g,'_');const summary={...p.meta,project_name:p.project?.project?.name||'',card_count:p.cards.length,card_types:p.cards.reduce((m,c)=>(m[c.type]=(m[c.type]||0)+1,m),{})};const readme=`# Guild Adventure Studio AI引き継ぎ

最初にgovernance/AI_START.mdだけを読んで作業モードを判定してください。READ_ONLY調査では作業種別宣言は不要です。編集へ進む場合は規範的運用ポリシーを確認し、そのconditional_documentsに従って必要な手順だけを追加で読んでください。

## 最小起動
1. governance/AI_START.md
2. 編集時のみ governance/package-build.json
3. README.md / project-summary.json / 必要なdata

## 条件ポリシー
- Source編集: governance/AI_WORK_RULES.md
- 成果物生成: governance/docs/operations/ARTIFACT_SUBMISSION_POLICY.md
- 削除: governance/docs/operations/DELETION_POLICY.md
- Game Data: governance/docs/operations/GAME_DATA_DEPLOYMENT_MANUAL.md
- Development Project: governance/docs/operations/DEVELOPMENT_PROJECT_AI_PROTOCOL.md
- 規範的運用ポリシー: governance/shared/integrity/ai-operating-policy.json

package_manifest.json全文はAI起動時に読まず、Source整合性は機械Gateで検証します。Test / Gate / timeout基準は緩和しません。
`;
 const prompt=`添付ZIPでは最初にgovernance/AI_START.mdだけを読み、READ_ONLYかEDITかを判定してください。READ_ONLYなら必要なデータだけ調査し、作業種別宣言は不要です。EDITならgovernance/shared/integrity/ai-operating-policy.jsonを規範的正本として読み、そのwork_typesとconditional_documentsに従ってください。package_manifest.json全文を起動時に読み込まず、整合性は機械Gateで確認してください。Test / Gate / timeoutの合格基準は弱めないでください。成果物は正式経路で分離してください。`;
 const files=[{name:'README.md',data:readme},{name:'AI_PROMPT.txt',data:prompt},{name:'project-summary.json',data:safeJson(summary)},{name:'data/project.json',data:safeJson(p.project)},{name:'data/design-cards.json',data:safeJson({schema:'gk-design-cards',cards:p.cards})},{name:'guides/verification-guide.md',data:guideMd()},{name:'references/card-reference-values.json',data:safeJson(typeof getDesignReferenceValues==='function'?getDesignReferenceValues():{})}];files.push(...await loadGovernanceExportFiles());saveBlob(`GK_AI_Project_${name}.zip`,zipStore(files));const s=document.getElementById('gkAiExportStatus');if(s)s.textContent='AI用ZIPを出力しました。';}catch(e){alert('AIエクスポート失敗: '+e.message);}};
function addEntry(){const grid=document.querySelector('#view-verification .grid.two');if(grid&&!document.getElementById('gkAiExportCard')){const c=document.createElement('div');c.className='card';c.id='gkAiExportCard';c.innerHTML='<h2>AIへ渡す</h2><p>プロジェクト、設計カード、参照値、検証ガイドをAI用ZIPへまとめます。</p><div class="toolbar"><button class="primary" type="button" onclick="exportProjectForAI()">AI用ZIPを出力</button><button type="button" onclick="openVerificationGuide(\'ai\')">使い方</button></div><div id="gkAiExportStatus" class="small gk-ai-export-status"></div>';grid.appendChild(c);}const panel=document.querySelector('#launcherPanel-verify .launcher-action-grid');if(panel&&!document.getElementById('gkAiExportLauncherButton')){const b=document.createElement('button');b.id='gkAiExportLauncherButton';b.type='button';b.textContent='AIエクスポート';b.onclick=()=>exportProjectForAI();panel.appendChild(b);}}
document.addEventListener('DOMContentLoaded',addEntry);
})();
