const assert=require('assert'),fs=require('fs');
const build=require('../package-build.json');
assert.strictEqual(build.studio_build,'GKS-B555');
const sg=fs.readFileSync('studio/skill/skill-generator.js','utf8');
const ui=fs.readFileSync('studio/data-exchange/data-exchange-ui.js','utf8');
const html=fs.readFileSync('studio/index.html','utf8');

for(const needle of [
 'gks_g07_last_apply_session_v1_',
 'g07RememberUndoSession(auditSession)',
 'g07ReadUndoSessionId()',
 "undoSessionById(sessionId,{expectedDataset:'skills'})",
 "String(out.dataset||'')!=='skills'",
 'dataset skills / session ${esc(sessionId)}'
]) assert.ok(sg.includes(needle),'missing G07 exact-session guard: '+needle);

assert.ok(!/skgG07Undo'\)\.onclick[\s\S]{0,1200}undoLatestSession/.test(sg),'G07 must not call globally latest Undo session');
for(const needle of [
 'function findUndoableSessionById(sessionId,expectedDataset',
 'async function undoSessionById(sessionId,options={})',
 "String(session.dataset||'')!==String(expectedDataset)",
 'return undoAuditSession(session);'
]) assert.ok(ui.includes(needle),'missing Data Exchange explicit-session API: '+needle);

assert.ok(html.includes('skill-generator.js?v=27'));
assert.ok(html.includes('data-exchange-ui.js?v=23'));
console.log('PASS GKS-B555 G07 exact skills-session Undo targeting');
