const assert=require('assert');
const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.resolve(__dirname,'../studio/index.html'),'utf8');
const manual=fs.readFileSync(path.resolve(__dirname,'../docs/operations/GAME_DATA_DEPLOYMENT_MANUAL.md'),'utf8');
const build=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../package-build.json'),'utf8'));
const policy=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../shared/integrity/system-file-policy.json'),'utf8'));
assert(policy.classes.game_data.patterns.includes('Export/**'),'system policy must classify Export/** as game_data');
assert(policy.rules.source_allowed_classes.includes('game_data'),'full source must be allowed to carry bundled Export for local/runtime validation');
assert(!policy.rules.update_allowed_classes.includes('game_data'),'Studio direct update packages must not carry game_data');
assert.deepStrictEqual(policy.rules.studio_upload_classes,['persistent'],'Studio GitHub upload must be persistent-only');
assert.strictEqual(build.game_build,'GA-B486.211');
assert.strictEqual(build.studio_build,'GKS-B681');
for(const marker of [
  "function isStudioDeployGameDataPath(path)",
  "return normalized==='Export'||normalized.startsWith('Export/');",
  "const gameDataBoundaryExcluded=isStudioDeployGameDataPath(relative);",
  "gameDataBoundaryExcluded?'Gameデータ配置専用: Export/'",
  "if(!path||isStudioDeployGameDataPath(path))return false;",
  "if(isStudioDeployGameDataPath(base))throw new Error('Studio更新の配置先フォルダにExport/は指定できません。Gameデータ配置を使用してください。');",
  "if(isStudioDeployGameDataPath(relative))continue;",
  ".filter(rule=>!isStudioDeployGameDataPath(rule))",
  "Studio更新がExport/へ触れようとしたため停止しました",
  "安全停止: Studio更新ではExport/を配置・削除できません。Gameデータ配置を使用してください。",
  "Studio更新では <code>Export/</code> を配置・削除しません。",
  "async function verifyStudioDeployBaselineBinding(remote,base,meta)",
  "baseline_source.package_manifest_sha256が不正です。",
  "更新ZIPの基準とGitHub HEADが一致しません。package_manifest SHA-256",
  "更新ZIPの基準BuildとGitHub HEADが一致しません。",
  "await verifyStudioDeployBaselineBinding(remote,base,studioDeployMeta);",
  "async function verifyStudioUpdateArtifactIdentity(packageReader,meta,build)",
  "更新ZIPにtarget_sourceがありません。対象ソースと成果物IDを固定した更新ZIPを使用してください。",
  "STUDIO_BUILD_TRANSITION_NOT_FORWARD: baseline=",
  "target_source.package_manifest SHA-256が更新ZIPと一致しません。",
  "artifact_idがtarget source treeへ結び付いていません。",
  "studioDeployArtifactIdentity=await verifyStudioUpdateArtifactIdentity(packageReader,meta,studioDeployCurrentBuild);",
  "STUDIO_BUILD_TRANSITION_NOT_FORWARD: GitHub HEAD="
]) assert(html.includes(marker),marker+' missing');
assert(manual.includes('更新ZIPに含まれるソース（`Export/`は強制除外）'),'manual must document Studio deploy Export boundary');
assert(manual.includes('GitHub上の公開Gameデータを更新できる窓口はGameデータ配置だけ'),'manual must document sole Export deployment authority');

const registry=JSON.parse(fs.readFileSync('shared/tests/test-registry.json','utf8'));
const sourceOnly=new Set(registry.release_gate.filter(x=>Array.isArray(x.contexts)&&x.contexts.length===1&&x.contexts[0]==='source').map(x=>x.path));
for(const rel of [
  'tests/aura-revive-connection-ga-b486-28.js',
  'tests/action-disabled-tag-validation-ga-b486-38.js',
  'tests/cooldown-tag-validation-ga-b486-41.js',
  'tests/cost-tag-validation-ga-b486-44.js',
  'tests/activation-priority-tag-validation-p01-12-val1.js',
  'tests/simultaneous-activation-order-formal-p01-13.js',
  'tests/test_r06_cover_validation_positive_gks_b552.js',
  'tests/formal-production-skill-export-gks-b555.js',
  'tests/formal-game-title-start-skill-tags-resilience-ga-b486-168.js'
]) assert(sourceOnly.has(rel),`Export fixture test must be source-only in update inspection: ${rel}`);
const registryRunner=fs.readFileSync('tools/integrity/check-test-registry.py','utf8');
assert(registryRunner.includes("parser.add_argument('--context', choices=('source', 'update'), default='source')"),'test registry checker must accept inspection context');
assert(registryRunner.includes('if context not in contexts:'),'test registry checker must skip source-only tests in update context');
const inspectionRunner=fs.readFileSync('tools/inspection/run.py','utf8');
assert(inspectionRunner.includes('"--context", context'),'inspection runner must pass context to active test gate');

console.log('PASS GKS-B681 Studio SOURCE_UPDATE gate hard-excludes root Export/, verifies exact baseline, and rejects non-forward/same-Build artifact reuse');
