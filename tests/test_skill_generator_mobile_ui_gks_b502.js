const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'studio/skill/skill-generator.js'),'utf8');
const index=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
const config=fs.readFileSync(path.join(root,'assets/shared/config/runtime-config.js'),'utf8');
function need(cond,msg){if(!cond)throw new Error(msg);}
need(js.includes('.skg-runtime-grid input[type=checkbox]'),'mobile checkbox override missing');
need(js.includes('width:22px!important'),'checkbox width must be fixed');
need(js.includes('flex:0 0 22px'),'checkbox must not consume card width');
need(js.includes('min-width:0;width:100%;box-sizing:border-box'),'runtime card containment missing');
need(js.includes('class="skg-runtime-name"'),'runtime label span missing');
need(js.includes('<b>${x}</b>'),'runtime code label missing');
need(js.includes('.skg-runtime-name{display:flex;flex-direction:column;min-width:0;max-width:100%;overflow:hidden'),'runtime label overflow containment missing');
const build=JSON.parse(fs.readFileSync(path.join(root,'package-build.json'),'utf8'));
need(index.includes(build.studio_build),'Studio build display is not synchronized with package-build.json');
need(config.includes(`studioBuild: "${build.studio_build}"`),'runtime config Studio build is not synchronized with package-build.json');
need(/\.\/skill\/skill-generator\.js\?v=\d+/.test(index),'skill generator cache key missing');
console.log('SKILL_GENERATOR_MOBILE_UI_REGRESSION_PASS');
