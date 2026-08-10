const fs=require('fs');
const assert=require('assert');
const js=fs.readFileSync('studio/equipment/equipment-generator.js','utf8');
for(const text of ['eqg-touch-stack','eqg-touch-details','eqg-json-paste','min-height:52px','gap:12px']) assert(js.includes(text),'タップUI定義が不足: '+text);
for(const text of ['係数を変更する','武器ベースアイテムセット','防具ベースアイテムセット']) {
  const re=new RegExp('<details class="eqg-touch-details"[^>]*><summary><b>'+text.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')+'</b></summary>');
  assert(re.test(js),'生成設定の大きなタップ領域が不足: '+text);
}
assert((js.match(/class="eqg-touch-details eqg-json-paste"/g)||[]).length===2,'武器/防具のJSON貼付タップ領域が2つありません');
assert(js.includes('.eqg-kind-panel>.item{margin:12px 0}'),'ファイル状態表示の上下余白が不足');
assert(js.includes('.eqg-kind-panel>.eqg-actions{margin-top:14px;gap:10px}'),'JSON操作ボタン間隔が不足');
console.log('EQUIPMENT_TOUCH_UI_GKS_B499_OK');
