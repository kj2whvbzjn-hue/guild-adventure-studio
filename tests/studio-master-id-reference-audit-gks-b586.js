const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');

assert.ok(html.includes('id="masterIdReferenceAuditResult"'),'Master audit result panel missing');
assert.ok(html.includes('function buildMasterIdReferenceAudit()'),'Master audit builder missing');
assert.ok(html.includes('function runMasterIdReferenceAudit()'),'Master audit runner missing');

const start=html.indexOf('const MASTER_AUDIT_REFERENCE_CATEGORY_RULES=');
const end=html.indexOf('function masterSearchText(category,m){',start);
assert.ok(start>=0&&end>start,'audit function source range missing');
const source=html.slice(start,end);

const prefixes={tags:'TAG',stats:'STA',jobs:'JOB',skills:'SKL',equipment:'EQP',mods:'MOD',monsters:'MON',status_effects:'STS',tablets:'TBL',ai_conditions:'AIC',ai_targets:'AIT',ai_actions:'AIA',maps:'MAP',exploration_outcomes:'EXP',reward_tables:'RWD',adventure_settings:'ADV'};
const context={
  data:{
    tags:[{id:'TAG-0001',name:'forest'}],
    masters:{
      stats:[],jobs:[],
      skills:[{id:'SKL-0001',name:'valid skill'},{id:'SKL-LEGACY',name:'legacy skill'}],
      equipment:[],mods:[],
      monsters:[{id:'MON-0001',name:'monster',tags:['TAG-0001'],params:{skill_ids:['SKL-LEGACY','SKL-9999','MON-0001'],drop_table_ids:['RWD-0001']}}],
      status_effects:[],tablets:[],ai_conditions:[],ai_targets:[],ai_actions:[],maps:[],exploration_outcomes:[],
      reward_tables:[{id:'RWD-0001',name:'drop'}],adventure_settings:[]
    },
    quests:[{id:'QST-0001',map_id:'MAP-9999'}],events:[],characters:[],entities:[],flags:[],chapters:[]
  },
  MASTER_LABELS:{tags:'タグ',stats:'能力値',jobs:'職業',skills:'スキル',equipment:'装備',mods:'MOD',monsters:'モンスター',status_effects:'状態異常',tablets:'石板',ai_conditions:'AI条件',ai_targets:'AI対象',ai_actions:'AI行動',maps:'マップ',exploration_outcomes:'探索結果',reward_tables:'報酬テーブル',adventure_settings:'冒険設定'},
  masterPrefix(category){return prefixes[category]||'MST'},
  masterIdPattern(category){return new RegExp('^'+(prefixes[category]||'MST')+'-\\d{4}$')},
  now(){return '2026-08-15T00:00:00.000Z'},
  window:{}, document:{getElementById(){return null}}, esc(v){return String(v)}
};
vm.createContext(context);
vm.runInContext(source,context);
const report=vm.runInContext('buildMasterIdReferenceAudit()',context);
assert.strictEqual(report.counts.invalid_ids,1,'legacy skill ID must be reported');
assert.ok(report.issues.some(x=>x.type==='invalid_id'&&x.id==='SKL-LEGACY'&&x.reference_count===1),'invalid ID must report its structured reference count');
assert.ok(report.issues.some(x=>x.type==='missing_reference'&&x.id==='SKL-9999'),'missing Skill reference must be reported');
assert.ok(report.issues.some(x=>x.type==='category_mismatch'&&x.id==='MON-0001'&&x.expected_category==='skills'),'wrong-category reference must be reported');
assert.ok(report.issues.some(x=>x.type==='missing_reference'&&x.id==='MAP-9999'),'Quest master reference must be audited');
assert.strictEqual(context.data.masters.skills[1].id,'SKL-LEGACY','audit must not mutate data');
console.log('PASS GKS-B587 Master ID/reference audit is read-only and reports format/missing/category issues');
