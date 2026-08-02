(function(){
'use strict';
const guides={
 home:{title:'検証ホーム',summary:'検証で使う機能の入口です。設計用カードを作り、戦闘へ反映し、一括検証します。',steps:['比率計算で基礎値を作る','計算カードで値を組み合わせる','装備・スキル・キャラクター・編成カードを作る','編成を戦闘入力へ反映する','戦闘テストまたは一括検証を実行する'],tips:['正式データを直接書き換えず、検証カードで試す','カードIDとマスターIDは途中で変えない']},
 ratio:{title:'比率計算',summary:'複数ステータスの比率と係数から値を作ります。例: 力6・器用3・知性1、係数2 → 12・6・2。',steps:['カード種類で「比率」を選ぶ','ステータス名と比率を入力する','係数を入力して保存する','生成された「カードID.項目名」または「カードID.total」を他カードで参照する'],tips:['使わない項目は比率0','比率変更後は参照先も自動再計算']},
 formula:{title:'計算カード',summary:'比率結果や他カードの結果を入力として、加算・乗算・条件などを組み立てます。',steps:['入力元を参照一覧から選ぶ','演算を追加する','各行を有効または無効にする','カードを保存し「カードID.value」を参照する'],tips:['乗算を無効化する初期値は1','加算を無効化する初期値は0','ゼロ除算は避ける']},
 battle:{title:'戦闘テスト',summary:'保存した編成と計算設定を使い、Tick制の戦闘を再現します。',steps:['味方編成と敵編成を選ぶ','選択編成を戦闘入力へ反映する','計算設定を選ぶ','Seedと最大Tickを確認する','実行してログと集計を見る'],tips:['比較時は同じSeedを使う','最初は1戦のログを確認し、その後1000回以上で集計する']},
 sweep:{title:'一括検証',summary:'1つの値を開始値から終了値まで刻み幅ごとに変え、全ケースをまとめて実行します。',steps:['検証項目を選ぶ','開始・終了・刻みを設定する','各ケースの試行回数を設定する','総戦闘回数を確認する','実行してJSON/CSVを保存する'],tips:['広く粗く試し、良い範囲を細かく再検証','平均だけでなく勝率・引分率・平均Tickも見る']},
 assets:{title:'検証用カード',summary:'装備、スキル、キャラクター、味方編成、敵編成を別カードで作り、ID参照で接続します。',steps:['表示名・カードID・マスターIDを入力する','装備またはスキルを保存する','キャラクターから装備ID・スキルIDを参照する','編成からキャラクターIDを参照する'],tips:['数値をコピーせずID参照を使う','テスト上書きは元カードを変更しない']},
 ai:{title:'AIエクスポート',summary:'現在のプロジェクト、設計カード、検証設定、ガイドをAIが読めるZIPへまとめます。',steps:['プロジェクトを端末保存する','AIエクスポートを実行する','生成ZIPをAIへ添付する','README.mdから読むようAIへ伝える'],tips:['カードIDとマスターIDを維持するよう指示する','個人情報や秘密鍵が含まれないことを確認する']}
};
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function close(){document.getElementById('gkVerificationGuideOverlay')?.remove();}
window.openVerificationGuide=function(key='home'){
 const g=guides[key]||guides.home; close();
 const el=document.createElement('div');el.id='gkVerificationGuideOverlay';el.className='gk-guide-overlay';
 el.innerHTML=`<div class="gk-guide-dialog" role="dialog" aria-modal="true"><div class="gk-guide-head"><div><b>${esc(g.title)}</b><div class="small">使い方ガイド</div></div><button type="button" onclick="closeVerificationGuide()">閉じる</button></div><div class="gk-guide-body"><p>${esc(g.summary)}</p><h3>手順</h3>${g.steps.map((x,i)=>`<div class="gk-guide-step"><b>${i+1}.</b> ${esc(x)}</div>`).join('')}<h3>ポイント</h3><ul>${g.tips.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="toolbar"><button type="button" onclick="exportVerificationGuideMarkdown('${esc(key)}')">Markdown出力</button></div></div></div>`;
 el.addEventListener('click',e=>{if(e.target===el)close()});document.body.appendChild(el);
};
window.closeVerificationGuide=close;
window.exportVerificationGuideMarkdown=function(key){const g=guides[key]||guides.home;const md=`# ${g.title}\n\n${g.summary}\n\n## 手順\n${g.steps.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\n## ポイント\n${g.tips.map(x=>`- ${x}`).join('\n')}\n`; if(typeof downloadText==='function')downloadText(`GK_Guide_${key}.md`,md,'text/markdown;charset=utf-8');};
window.GK_VERIFICATION_GUIDES=guides;
function addHelpButtons(){
 const mappings=[['view-verification','home'],['battleFormulaSettings','battle'],['designCardSystem','assets']];
 mappings.forEach(([id,key])=>{const root=document.getElementById(id);if(!root||root.querySelector('.gk-help-button'))return;const h=root.querySelector('h1,h2');if(!h)return;const b=document.createElement('button');b.type='button';b.className='gk-help-button';b.textContent='？';b.title='使い方';b.onclick=()=>openVerificationGuide(key);h.insertAdjacentElement('afterend',b);});
}
function addGuideEntry(){const grid=document.querySelector('#view-verification .grid.two');if(grid&&!document.getElementById('gkGuideEntryCard')){const c=document.createElement('div');c.className='card';c.id='gkGuideEntryCard';c.innerHTML='<h2>使い方ガイド</h2><p>検証機能の順番、入力項目、参照方法、よくある失敗を確認します。</p><div class="toolbar"><button class="primary" type="button" onclick="openVerificationGuide(\'home\')">ガイドを開く</button></div>';grid.appendChild(c);} const panel=document.querySelector('#launcherPanel-verify .launcher-action-grid');if(panel&&!document.getElementById('gkGuideLauncherButton')){const b=document.createElement('button');b.id='gkGuideLauncherButton';b.type='button';b.textContent='使い方ガイド';b.onclick=()=>openVerificationGuide('home');panel.appendChild(b);}}
document.addEventListener('DOMContentLoaded',()=>{addGuideEntry();addHelpButtons();});
})();
