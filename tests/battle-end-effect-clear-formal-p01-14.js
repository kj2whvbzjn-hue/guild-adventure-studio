const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
const ctl=fs.readFileSync(path.join(root,'game/assets/js/battle-control.js'),'utf8');const app=fs.readFileSync(path.join(root,'game/assets/js/app-runtime.js'),'utf8');
const spec=JSON.parse(fs.readFileSync(path.join(root,'docs/design/P01-14_BATTLE_END_EFFECT_CLEAR_VALIDATION_SPEC.json'),'utf8'));const build=JSON.parse(fs.readFileSync(path.join(root,'package-build.json'),'utf8'));
const must=(x,m)=>{if(!x){console.error('FAIL',m);process.exit(1)}};
must(/^GA-B\d+(?:\.\d+)+$/.test(build.game_build||''),'build');must(spec.formal_candidate==='P01-14-FORMAL-1'&&spec.formal_runtime_change===true,'formal spec');
for(const x of ['clearBattleEndDotStacks();','clearBattleEndModifierStacks();','clearBattleEndCooldowns();'])must(ctl.includes(x),x);
must(app.includes("'BATTLE-END-FORMAL-CLEAR-ALL-TRANSIENT'"),'formal case');must(app.includes("formal_candidate:'P01-14-FORMAL-1'"),'formal report');
console.log('BATTLE_END_EFFECT_CLEAR_P01_14_FORMAL1_GA_B486_58_OK');
