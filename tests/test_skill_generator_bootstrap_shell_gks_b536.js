const assert=require('assert');
const fs=require('fs');
const html=fs.readFileSync('studio/index.html','utf8');
const skg=fs.readFileSync('studio/skill/skill-generator.js','utf8');
const sw=fs.readFileSync('studio/sw.js','utf8');

assert.ok(html.includes('<section id="view-skill-generator" class="view hidden" data-skg-shell="loading">'),'Skill Generator bootstrap shell must exist in initial Studio HTML');
assert.ok(html.includes('id="skgBootStatus"'),'bootstrap shell must expose dependency status');
assert.ok(html.indexOf('id="view-skill-generator"') < html.indexOf('./skill/skill-generator.js?v=31'),'bootstrap shell must exist before dynamic script load');
assert.ok(skg.includes("if(s&&s.dataset.skgShell!=='loading')return"),'renderPanel must reuse bootstrap shell instead of abandoning it');
assert.ok(skg.includes("s.className=shellVisible?'view':'view hidden'"),'full panel must preserve an already-open shell');
assert.ok(skg.includes('Promise.allSettled'),'dependency boot must settle independently');
assert.ok(skg.includes("setBootStatus('初期化停止: '+message,'error')"),'dependency failure must be shown in the view');
assert.ok(skg.includes("document.dispatchEvent(new CustomEvent('gks:view-ready',{detail:{view:'skill-generator'}}))"),'view-ready notification must remain available');
assert.ok(html.includes("navigator.serviceWorker.register('./sw.js?v=555'"),'Studio service worker URL must advance');
assert.ok(html.includes("url.searchParams.set('appv','555')"),'Studio app reload key must advance');
assert.ok(sw.includes('gks-studio-b555'),'Studio cache namespace must advance');
assert.ok(sw.includes("const OFFLINE_URL='./index.html?appv=555'"),'offline shell must advance');
console.log('PASS GKS-B536 Skill Generator bootstrap shell / dependency failure visibility');
