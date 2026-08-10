const fs=require('fs');
const assert=require('assert');
const js=fs.readFileSync('studio/equipment/equipment-generator.js','utf8');
assert(js.includes('eqg-file-picker'),'ファイル選択UIクラスがありません');
assert(js.includes('input[type=file]::file-selector-button'),'ネイティブファイル選択ボタンのiPhone向けスタイルがありません');
for(const [id,label] of [['eqgWeaponJsonFile','武器JSONを選択'],['eqgArmorJsonFile','防具JSONを選択']]){
  const re=new RegExp(`<input id="${id}" type="file" accept="\\.json,application/json" aria-label="${label}">`);
  assert(re.test(js),`${id} が可視のネイティブファイル入力になっていません`);
}
assert(!js.includes('id="eqgWeaponJsonFileName"'),'武器の独立ファイル状態ボックスが残っています');
assert(!js.includes('id="eqgArmorJsonFileName"'),'防具の独立ファイル状態ボックスが残っています');
assert(!js.includes('for="eqgWeaponJsonFile">武器JSONを選択'),'旧武器ラベル式ファイル選択が残っています');
assert(!js.includes('for="eqgArmorJsonFile">防具JSONを選択'),'旧防具ラベル式ファイル選択が残っています');
assert(js.includes('status.textContent=`${f.name} を読み込みました。試算してください。`;'),'選択後の読込状態表示がありません');
console.log('EQUIPMENT_FILE_PICKER_UI_GKS_B500_OK');
