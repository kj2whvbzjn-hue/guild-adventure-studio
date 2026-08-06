const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('game-tag-test/index.html','utf8');
const runtime=fs.readFileSync('game-tag-test/assets/js/validation-runtime.js','utf8');
assert(html.includes('id="tagTestRunHealJson"'),'回復JSON検証ボタンがありません');
assert(runtime.includes("test:{id:'TAG-HEAL-DEVICE-001'"),'回復実機JSONテストIDがありません');
for(const id of ['HEAL-SINGLE','HEAL-ALL','HEAL-DEAD-REJECT','HEAL-ENEMY-REJECT','HEAL-INVALID-DATA-REJECT'])assert(runtime.includes(`'${id}'`),`${id} がありません`);
assert(runtime.includes("schema_version:'1.3.0'"),'過去形式に合わせたschema_versionがありません');
assert(runtime.includes("summary:{case_count:"),'AI判定用summaryがありません');
assert(runtime.includes('function ensureHealValidationFixtures()'),'回復検証fixture初期化がありません');
assert(runtime.includes("resetBattle();ensureHealValidationFixtures();"),'各ケース開始時にfixtureを初期化していません');
assert(runtime.includes("SKL-TEST-HEAL-100"),'単体回復fixtureがありません');
assert(runtime.includes("SKL-TEST-HEAL-ALL-60"),'全体回復fixtureがありません');
assert(runtime.includes("a.download=`tag-heal-device-validation-GA-B484.2-"),'回復JSONファイル名がありません');

assert(runtime.includes("build:'GA-B484.2'"),'回復JSON buildがGA-B484.2ではありません');
assert(html.includes('validation-runtime.js?v=4842'),'タグ検証ランタイムのキャッシュバスターがありません');
assert(html.includes("data.gameVersion='GA-B484.2'"),'タグ検証の保存ビルドがGA-B484.2ではありません');
const tagSw=fs.readFileSync('game-tag-test/sw.js','utf8');
assert(tagSw.includes('ga-tag-test-b4842'),'タグ検証Service Workerキャッシュが更新されていません');
assert(tagSw.includes('validation-runtime.js?v=4842'),'Service Workerが旧検証ランタイムを参照しています');

console.log('HEAL_DEVICE_JSON_GA_B483_2_OK');
