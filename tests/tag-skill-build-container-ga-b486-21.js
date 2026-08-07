const fs=require('fs');
const assert=require('assert');
const app=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const runtime=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
assert(app.includes("const TAG_SKILL_BUILD="),'正式利用するタグスキルBuild入れ物がありません');
assert(runtime.includes('${TAG_SKILL_BUILD}'),'タグスキルRuntimeが正式Build入れ物を参照していません');
assert(!app.includes('TAG_SKILL_TEST_BUILD'),'正式利用する入れ物名にTESTが残っています');
assert(!runtime.includes('TAG_SKILL_TEST_BUILD'),'正式Runtime参照にTESTが残っています');
console.log('TAG_SKILL_BUILD_CONTAINER_GA_B486_21_OK');
