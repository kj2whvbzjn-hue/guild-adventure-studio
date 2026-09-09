const fs=require('fs');
const assert=require('assert');

const html=fs.readFileSync('studio/index.html','utf8');
const fullImport=fs.readFileSync('studio/data-exchange/full-import-gate.js','utf8');
const dataExchange=fs.readFileSync('studio/data-exchange/data-exchange-core.js','utf8');
const studioExport=fs.readFileSync('studio/export-core.js','utf8');
const rootExport=fs.readFileSync('export-core.js','utf8');
const battleCore=fs.readFileSync('assets/shared/js/adventure-battle-core.js','utf8');
const appRuntime=fs.readFileSync('game/assets/js/app-runtime.js','utf8');
const battleControl=fs.readFileSync('game/assets/js/battle-control.js','utf8');
const tagSkill=fs.readFileSync('game/assets/js/tag-skill-runtime.js','utf8');
const monsterExportSchema=JSON.parse(fs.readFileSync('schemas/exports/monster-monsters.schema.json','utf8'));
const monsterExchangeSchema=JSON.parse(fs.readFileSync('studio/data-exchange/schemas/monster-dataset.schema.json','utf8'));

// Monster Master UI: Current ProjectのAI authorityから候補を導出し、具体的なCurrent IDを固定しない。
assert(html.includes('id="masterMonsterFormationPosition"'),'Monster Default Formation Position UIがありません');
assert(html.includes('id="masterMonsterFormalAiBinding"'),'Monster Formal AI UIがありません');
assert(html.includes('function monsterFormalAiCandidates()'),'Monster Formal AI候補導出関数がありません');
const candidateFn=html.match(/function monsterFormalAiCandidates\(\)\{[\s\S]*?\n\}/)?.[0]||'';
assert(candidateFn.includes('data.ai_programs')&&candidateFn.includes('data.ai_program_layouts')&&candidateFn.includes('data.ai_program_runtime'),'Monster Formal AI候補がCurrent ProjectのProgram/Layout/Runtimeから導出されていません');
assert(!/AIP-[0-9]{4}|AIL-[0-9]{4}/.test(candidateFn),'Monster Formal AI候補に具体的なCurrent AI IDがハードコードされています');

// Monster save: 既存top-level fieldを保持し、formalAiBindingをMonster直下だけに保存する。
assert(html.includes("if(Object.prototype.hasOwnProperty.call(params,'formalAiBinding'))return alert('formalAiBindingはMonster Master直下だけに保存できます。')"),'params.formalAiBinding拒否がありません');
assert(html.includes('const formalAiBinding=selectedMonsterFormalAiBinding()'),'Monster Formal AIがUI選択から解決されていません');
assert(html.includes("rec={...(existing||{}),id,name,status:masterStatus.value,tags,params,description:masterDescription.value||'',enabled:existing&&Object.prototype.hasOwnProperty.call(existing,'enabled')?existing.enabled:true,default_formation_position:defaultFormationPosition,formalAiBinding,updated_at:now()}"),'Monster保存が既存top-level fieldを保持していません');
assert(html.includes('renderMonsterFormalAiOptions(m.formalAiBinding)'),'既存Monster編集時にformalAiBindingを復元していません');

// Full Import / Data Exchange / Formal Exportが同じMonster契約を守る。
assert(fullImport.includes('function monsterRuntimeContractIssues(rootData)'),'Full ImportにMonster Runtime契約検証がありません');
assert(fullImport.includes("/^AIP-\\d{4}$/.test(programId)")&&fullImport.includes("/^AIL-\\d{4}$/.test(layoutId)"),'Full ImportのAI ID形式が4桁規則ではありません');
assert(dataExchange.includes("{dataset:'ai_programs',paths:['formalAiBinding.program_id']}"),'Data ExchangeにMonster→AI Program依存がありません');
assert(dataExchange.includes("{dataset:'ai_program_layouts',paths:['formalAiBinding.layout_id']}"),'Data ExchangeにMonster→AI Layout依存がありません');
assert(dataExchange.includes("{dataset:'ai_program_runtime',paths:['formalAiBinding.program_id']}"),'Data ExchangeにMonster→AI Runtime依存がありません');
assert(dataExchange.includes("'enabled','default_formation_position','formalAiBinding'"),'Data ExchangeのMonster許可fieldにCurrent top-level fieldがありません');
assert(studioExport.includes('function collectMonsterRuntimeExportIssues(data)'),'Studio Formal ExportにMonster Runtime契約検証がありません');
assert.strictEqual(rootExport,studioExport,'root export-core.jsがStudio Formal Export正本と一致していません');

// Schema: Monsterは明示隊列＋non-null binding、AIP/AILは4桁命名規則。
const exportItem=monsterExportSchema?.items||monsterExportSchema?.properties?.data?.items;
assert(exportItem,'Monster Export Schemaのrecord schemaを取得できません');
assert(exportItem.required.includes('default_formation_position'),'Monster Export Schemaでdefault_formation_positionが必須ではありません');
assert(exportItem.required.includes('formalAiBinding'),'Monster Export SchemaでformalAiBindingが必須ではありません');
assert.strictEqual(exportItem.properties.formalAiBinding.type,'object','Monster Export SchemaがformalAiBinding=nullを許可しています');
assert.strictEqual(exportItem.properties.formalAiBinding.properties.program_id.pattern,'^AIP-[0-9]{4}$','Monster Export SchemaのProgram ID規則が不正です');
assert.strictEqual(exportItem.properties.formalAiBinding.properties.layout_id.pattern,'^AIL-[0-9]{4}$','Monster Export SchemaのLayout ID規則が不正です');
const exchangeItem=monsterExchangeSchema?.properties?.records?.items||monsterExchangeSchema?.items;
assert(exchangeItem.required.includes('default_formation_position')&&exchangeItem.required.includes('formalAiBinding'),'Monster Data Exchange Schemaの必須fieldが不足しています');

// Battle: pure normalizationとProduction binding gateを分離し、実戦経路は必ずgateを通す。
assert(battleCore.includes('function validateFormalFormationBindings(formation,monsters)'),'Production Monster binding gateがありません');
assert(battleCore.includes("normalizeFormalAiBinding(monster?.formalAiBinding,{nullable:true})"),'monsterStatsの純粋正規化でbindingを不要にできていません');
assert(appRuntime.includes('GKAdventureBattleCore.validateFormalFormationBindings(')&&appRuntime.includes('GKAdventureBattleCore.expandFormation('),'app-runtimeがProduction binding gateを通っていません');
assert(battleControl.includes('GKAdventureBattleCore.validateFormalFormationBindings(')&&battleControl.includes('GKAdventureBattleCore.expandFormation('),'battle-controlがProduction binding gateを通っていません');

// SINGLEは敵後衛を直接指定できないCurrent契約を明示拒否する。
assert(tagSkill.includes("reason:'SINGLEは敵後衛を対象にできません'"),'SINGLE敵後衛直接指定の明示拒否がありません');

console.log('MONSTER_FORMAL_AI_BINDING_GKS_B892_OK');
