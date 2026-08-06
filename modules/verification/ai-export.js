(function(){
'use strict';
const te=new TextEncoder();
const REQUIRED_GOVERNANCE=[
 {path:'AI_START.md',url:'../AI_START.md'},
 {path:'AI_PROJECT_INDEX.json',url:'../AI_PROJECT_INDEX.json'},
 {path:'AI_PROJECT_STATUS.json',url:'../AI_PROJECT_STATUS.json'},
 {path:'AI_WORK_RULES.md',url:'../AI_WORK_RULES.md'},
 {path:'docs/operations/ARTIFACT_SUBMISSION_POLICY.md',url:'../docs/operations/ARTIFACT_SUBMISSION_POLICY.md'},
 {path:'docs/operations/DELETION_POLICY.md',url:'../docs/operations/DELETION_POLICY.md'},
 {path:'package-build.json',url:'../package-build.json'},
 {path:'package_manifest.json',url:'../package_manifest.json'},
 {path:'shared/integrity/artifact-submission-policy.json',url:'../shared/integrity/artifact-submission-policy.json'}
];
async function loadRequiredGovernance(){
 const files=[];
 for(const item of REQUIRED_GOVERNANCE){
  const response=await fetch(item.url,{cache:'no-store'});
  if(!response.ok)throw new Error('必須AI運用ルールを取得できません: '+item.path+' ('+response.status+')');
  const content=await response.text();
  if(!content.trim())throw new Error('必須AI運用ルールが空です: '+item.path);
  files.push({name:'governance/'+item.path,data:content});
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
window.exportProjectForAI=async function(){try{const p=collect(),name=(p.project?.project?.id||p.meta.project_id||'project').replace(/[^A-Za-z0-9_.-]/g,'_');const summary={...p.meta,project_name:p.project?.project?.name||'',card_count:p.cards.length,card_types:p.cards.reduce((m,c)=>(m[c.type]=(m[c.type]||0)+1,m),{})};const readme=`# Guild Adventure Studio AI引き継ぎ\n\nこのZIPはエディタから出力された設計・検証データです。最初にgovernance/AI_START.mdを読み、そこに定めた順序で必須ルールを確認し、アップロード成果物は必ず1つのZIPで提出してください。\n\n## 読む順番\n1. governance/AI_START.md\n2. governance/AI_PROJECT_INDEX.json\n3. governance/AI_PROJECT_STATUS.json\n4. governance/AI_WORK_RULES.md\n5. governance/docs/operations/ARTIFACT_SUBMISSION_POLICY.md\n6. governance/docs/operations/DELETION_POLICY.md\n7. governance/package-build.json\n8. governance/package_manifest.json\n9. README.md\n10. project-summary.json\n11. guides/verification-guide.md\n12. data/design-cards.json\n13. data/project.json\n\n## 補助ポリシー\n- governance/shared/integrity/artifact-submission-policy.json\n\n## 作業開始前\n- governance/AI_START.mdの優先順位とPre-flightを完了してください。\n- 目的、変更範囲、変更しない範囲、削除有無、成果物、完了条件を作業宣言として確定してください。\n\n## 重要ルール\n- カードIDとマスターIDを維持してください。\n- 参照は表示名ではなくIDで扱ってください。\n- 不明な値を推測で上書きしないでください。\n- 提案値と正式採用値を区別してください。\n- 宣言した範囲外を便乗修正しないでください。\n- 完了時は追加・変更・削除・検査・未解決事項・成果物ZIPを報告してください。\n`;
 const prompt=`添付ZIPはGuild Adventure Studioのプロジェクトです。最初にgovernance/AI_START.mdを読み、起動順序、役割優先順位、Pre-flightを完了してください。実装前に目的、変更範囲、変更しない範囲、削除有無、成果物、完了条件を作業宣言として確定してください。宣言外の便乗修正は禁止です。アップロードを伴う成果物は種類を問わず必ず1つのZIPで提出してください。次にREADME.mdを読み、既存カードID・マスターID・参照関係を維持してください。仕様にない値は推測で確定せず、提案として明示してください。完了時は追加・変更・削除・検査・未解決事項・成果物ZIPを報告してください。`;
 const files=[{name:'README.md',data:readme},{name:'AI_PROMPT.txt',data:prompt},{name:'project-summary.json',data:safeJson(summary)},{name:'data/project.json',data:safeJson(p.project)},{name:'data/design-cards.json',data:safeJson({schema:'gk-design-cards',cards:p.cards})},{name:'guides/verification-guide.md',data:guideMd()},{name:'references/card-reference-values.json',data:safeJson(typeof getDesignReferenceValues==='function'?getDesignReferenceValues():{})}];files.push(...await loadRequiredGovernance());saveBlob(`GK_AI_Project_${name}.zip`,zipStore(files));const s=document.getElementById('gkAiExportStatus');if(s)s.textContent='AI用ZIPを出力しました。';}catch(e){alert('AIエクスポート失敗: '+e.message);}};
function addEntry(){const grid=document.querySelector('#view-verification .grid.two');if(grid&&!document.getElementById('gkAiExportCard')){const c=document.createElement('div');c.className='card';c.id='gkAiExportCard';c.innerHTML='<h2>AIへ渡す</h2><p>プロジェクト、設計カード、参照値、検証ガイドをAI用ZIPへまとめます。</p><div class="toolbar"><button class="primary" type="button" onclick="exportProjectForAI()">AI用ZIPを出力</button><button type="button" onclick="openVerificationGuide(\'ai\')">使い方</button></div><div id="gkAiExportStatus" class="small gk-ai-export-status"></div>';grid.appendChild(c);}const panel=document.querySelector('#launcherPanel-verify .launcher-action-grid');if(panel&&!document.getElementById('gkAiExportLauncherButton')){const b=document.createElement('button');b.id='gkAiExportLauncherButton';b.type='button';b.textContent='AIエクスポート';b.onclick=()=>exportProjectForAI();panel.appendChild(b);}}
document.addEventListener('DOMContentLoaded',addEntry);
})();
