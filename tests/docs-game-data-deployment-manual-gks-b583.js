const fs=require('fs');
const assert=require('assert');
const index=fs.readFileSync('docs/index.html','utf8');
const manual=fs.readFileSync('docs/operations/GAME_DATA_DEPLOYMENT_MANUAL.md','utf8');
const build=JSON.parse(fs.readFileSync('package-build.json','utf8'));
assert.strictEqual(build.studio_build,'GKS-B777');
assert.ok(index.includes('operations/GAME_DATA_DEPLOYMENT_MANUAL.md'),'資料トップからGameデータ配置マニュアルへリンクされていません');
for(const marker of ['初回デモデータを配置する手順','追加・差し替え・除外の意味','Flag運用','バランス調整の標準手順','配置前チェックリスト','配置後チェックリスト','ロールバックの意味','一時除外']){
  assert.ok(manual.includes(marker),`運用マニュアル必須項目が不足: ${marker}`);
}
assert.ok(manual.includes('Storyデータを再読込'),'Game側の再読込手順がありません');
assert.ok(manual.includes('GitHub上のファイル削除0件'),'Game配置の削除境界が明記されていません');
console.log('PASS GKS-B584 Game data deployment operations manual is linked from 資料 and covers demo deploy/balance/Flag/rollback safety');
