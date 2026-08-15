const fs=require('fs');
const assert=require('assert');
const build=require('../package-build.json');
const S=require('../assets/shared/js/adventure-story-system.js');
const R=require('../assets/shared/js/adventure-encounter-resolver.js');

assert.strictEqual(build.game_build,'GA-B486.185');
assert.strictEqual(build.studio_build,'GKS-B593');
assert.strictEqual(S.ADVENTURE_SETTINGS_CANONICAL_ID,'ADV-0001');
assert.strictEqual(S.ADVENTURE_SETTINGS_LEGACY_ID,'ADV-DEFAULT');
assert.strictEqual(R.ADVENTURE_SETTINGS_CANONICAL_ID,'ADV-0001');
assert.strictEqual(R.ADVENTURE_SETTINGS_LEGACY_ID,'ADV-DEFAULT');

const legacy=[{id:'ADV-DEFAULT',enabled:true,name:'legacy',params:{encounter:{max_units:11},reward_scaling:{bonus_per_budget:.11}}}];
const legacyRef=legacy[0];
const migrated=S.migrateAdventureSettingsRows(legacy);
assert.strictEqual(migrated.migrated,true,'legacy-only row must migrate');
assert.strictEqual(migrated.conflict,false);
assert.strictEqual(legacy.length,1,'migration must not add/delete rows');
assert.strictEqual(legacy[0],legacyRef,'migration must preserve the original record/object');
assert.strictEqual(legacy[0].id,'ADV-0001');
assert.strictEqual(legacy[0].params.encounter.max_units,11,'migration must preserve params');

const conflict=[
  {id:'ADV-DEFAULT',enabled:true,params:{encounter:{max_units:12}}},
  {id:'ADV-0001',enabled:true,params:{encounter:{max_units:22}}}
];
const conflictResult=S.migrateAdventureSettingsRows(conflict);
assert.strictEqual(conflictResult.migrated,false,'canonical+legacy conflict must not auto-rename');
assert.strictEqual(conflictResult.conflict,true,'canonical+legacy conflict must be reported');
assert.strictEqual(conflict[0].id,'ADV-DEFAULT','conflict must remain non-destructive');

const mixed=[
  {id:'ADV-DEFAULT',enabled:true,params:{encounter:{max_units:13},reward_scaling:{bonus_per_budget:.13}}},
  {id:'ADV-0001',enabled:true,params:{encounter:{max_units:23},reward_scaling:{bonus_per_budget:.23}}}
];
assert.strictEqual(S.selectAdventureSettingsRow(mixed).id,'ADV-0001','Story runtime must prefer canonical ID');
assert.strictEqual(S.adventureSettingsParams(mixed).encounter.max_units,23,'Story runtime must use canonical params');
assert.strictEqual(R.normalizeAdventureSettings(mixed).encounter.max_units,23,'Encounter runtime must prefer canonical ID');
assert.strictEqual(R.normalizeAdventureSettings([{id:'ADV-DEFAULT',enabled:true,params:{encounter:{max_units:14}}}]).encounter.max_units,14,'legacy-only Export must remain readable');

const studio=fs.readFileSync('studio/index.html','utf8');
for(const token of [
  "id:'ADV-0001',name:'冒険バランス既定'",
  "GKAdventureStorySystem.migrateAdventureSettingsRows(data.masters.adventure_settings)",
  "before-ADV-DEFAULT-to-ADV-0001-migration",
  "adventure settings id migrated ADV-DEFAULT -> ADV-0001",
  "normalizeLoadedProject({persistMigration:true})"
]) assert.ok(studio.includes(token),`Studio canonical migration missing: ${token}`);

const exported=JSON.parse(fs.readFileSync('Export/system/adventure_settings.json','utf8'));
assert.strictEqual(exported.data.length,1);
assert.strictEqual(exported.data[0].id,'ADV-0001','bundled formal Export must use canonical ID');

const manifest=JSON.parse(fs.readFileSync('Export/manifest.json','utf8'));
const entry=manifest.files.find(x=>x.path==='system/adventure_settings.json');
assert.ok(entry&&entry.sha256,'Export manifest must track adventure settings');
const crypto=require('crypto');
const actual=crypto.createHash('sha256').update(fs.readFileSync('Export/system/adventure_settings.json')).digest('hex');
assert.strictEqual(entry.sha256,actual,'Export manifest hash must match canonicalized adventure settings');

console.log('PASS GA-B486.185 / GKS-B593 Adventure Settings canonical ID migration preserves data, prefers ADV-0001, and keeps ADV-DEFAULT runtime fallback');
