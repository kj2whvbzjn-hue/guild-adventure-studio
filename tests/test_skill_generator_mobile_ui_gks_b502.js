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
need(js.includes('<span class="skg-runtime-name">${x}</span>'),'runtime label span missing');
need(js.includes('.skg-runtime-name{display:block;min-width:0;max-width:100%;overflow:hidden'),'runtime label overflow containment missing');
need(index.includes('GKS-B502'),'Studio build not bumped');
need(index.includes('./skill/skill-generator.js?v=2'),'skill generator cache key not bumped');
need(config.includes('studioBuild: "GKS-B502"'),'runtime config Studio build not bumped');
console.log('SKILL_GENERATOR_MOBILE_UI_GKS_B502_PASS');
