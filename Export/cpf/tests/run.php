<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use GK\CPF\Approval\CpfApprovalManager;
use GK\CPF\Core\{CpfException, CpfNodeManager, CpfProjectManager, CpfRegenerationManager};
use GK\CPF\Dependency\CpfDependencyManager;
use GK\CPF\Diff\CpfDiffService;
use GK\CPF\Generation\CpfGeneratorRegistry;
use GK\CPF\History\CpfHistoryRepository;
use GK\CPF\Migration\CpfMigrationManager;
use GK\CPF\Revision\CpfRevisionRepository;
use GK\CPF\Validation\CpfValidator;
use GK\CPF\Workflow\CpfWorkflowManager;
use GK\CPF\Story\{CpfStoryImporter, CpfStoryStructureAnalyzer};

$root = sys_get_temp_dir() . '/cpf_test_' . bin2hex(random_bytes(4));
$fail = 0;
function t(string $name, bool $ok): void { global $fail; echo ($ok ? '[PASS] ' : '[FAIL] ') . $name . "\n"; if (!$ok) $fail++; }
try {
    $project = (new CpfProjectManager())->create($root, 'CPF_PROJECT_001', 'Guild');
    t('project create', $project['current_phase'] === 'CPF-002A' && $project['schema_version'] === 2);

    $nodes = new CpfNodeManager();
    $story = $nodes->create($root, 'STORY001', 'story', ['title' => 'A']);
    $story = (new CpfApprovalManager())->approve($root, 'STORY001');
    t('approve node', $story['status'] === 'APPROVED');

    $chapter = $nodes->create($root, 'CH001', 'chapter', ['theme' => '王とは何か'], ['source_node_ids' => ['STORY001'], 'manual_fields' => ['theme']]);
    $chapter = $nodes->update($root, 'CH001', ['payload' => ['theme' => 'overwrite', 'boss' => 'ORC']], 'regen');
    t('manual field protected', $chapter['payload']['theme'] === '王とは何か' && $chapter['payload']['boss'] === 'ORC');
    $historyAfterUpdate = (new CpfHistoryRepository())->all($root);
    $updateHistory = end($historyAfterUpdate);
    t('update history preserves change reason', ($updateHistory['operation'] ?? '') === 'UPDATE' && ($updateHistory['change_reason'] ?? '') === 'regen' && in_array('payload', $updateHistory['changed_fields'] ?? [], true));

    $revisions = new CpfRevisionRepository();
    $candidate = $revisions->createCandidate($root, 'CH001', ['payload' => ['theme' => 'changed', 'boss' => 'DRAGON']], 'candidate');
    $current = $nodes->get($root, 'CH001');
    t('candidate isolated', $candidate['revision_status'] === 'CANDIDATE' && $current['payload']['boss'] === 'ORC' && $candidate['payload']['theme'] === '王とは何か');
    $promoted = $revisions->approveAndPromote($root, 'CH001', $candidate['revision_id'], 'user');
    t('candidate promote', $promoted['status'] === 'APPROVED' && $promoted['payload']['boss'] === 'DRAGON');
    $historyAfterPromote = (new CpfHistoryRepository())->all($root);
    $promoteHistory = end($historyAfterPromote);
    t('revision promotion history preserves reason and revision id', ($promoteHistory['operation'] ?? '') === 'PROMOTE_REVISION' && ($promoteHistory['change_reason'] ?? '') === 'candidate' && ($promoteHistory['metadata']['revision_id'] ?? '') === $candidate['revision_id']);

    $rejectedCandidate = $revisions->createCandidate($root, 'CH001', ['payload' => ['boss' => 'GOBLIN']], 'rejected candidate');
    $revisions->reject($root, 'CH001', $rejectedCandidate['revision_id'], 'not adopted');
    $historyAfterReject = (new CpfHistoryRepository())->all($root);
    $rejectHistory = end($historyAfterReject);
    t('revision rejection is written to history', ($rejectHistory['operation'] ?? '') === 'REJECT_REVISION' && ($rejectHistory['change_reason'] ?? '') === 'not adopted' && ($rejectHistory['metadata']['revision_id'] ?? '') === $rejectedCandidate['revision_id']);

    $stale = $revisions->createCandidate($root, 'CH001', ['payload' => ['boss' => 'SLIME']], 'stale');
    $nodes->update($root, 'CH001', ['payload' => ['note' => 'changed']], 'parallel');
    try { $revisions->approveAndPromote($root, 'CH001', $stale['revision_id']); t('stale candidate conflict', false); }
    catch (CpfException $e) { t('stale candidate conflict', $e->errorCode === 'REVISION_CONFLICT' && $e->exitCode === 4); }

    $chapter = (new CpfApprovalManager())->approve($root, 'CH001');
    $chapter = $nodes->lock($root, 'CH001', 'fixed');
    t('lock approved node', $chapter['locked'] && $chapter['status'] === 'LOCKED');
    try { $nodes->update($root, 'CH001', ['payload' => ['x' => 1]]); t('locked update rejected', false); }
    catch (CpfException $e) { t('locked update rejected', $e->errorCode === 'NODE_LOCKED' && $e->exitCode === 3); }

    $section = $nodes->create($root, 'CH001_SEC001', 'section', []);
    $dependency = (new CpfDependencyManager())->add($root, 'CH001', 'CH001_SEC001', 'PARENT', 'HIGH');
    $impact = (new CpfDependencyManager())->impact($root, 'CH001');
    t('dependency impact', count($impact) === 1 && $impact[0]['dependency_id'] === $dependency['dependency_id']);

    $diff = (new CpfDiffService())->diff(['a' => 1, 'x' => ['b' => 2]], ['a' => 2, 'x' => ['b' => 2]]);
    t('json diff', count($diff) === 1 && $diff[0]['path'] === 'a');
    try { (new CpfRegenerationManager())->request($root, 'CH001', 'change'); t('locked regeneration rejected', false); }
    catch (CpfException $e) { t('locked regeneration rejected', $e->errorCode === 'NODE_LOCKED'); }

    $workflowPath = dirname(__DIR__) . '/config/workflow-graph.json';
    $workflowErrors = (new CpfWorkflowManager())->validateGraph($workflowPath);
    t('workflow graph full validation', $workflowErrors === []);

    $registryPath = $root . '/generator-registry.json';
    file_put_contents($registryPath, json_encode(['version' => '1.0.0', 'generators' => []]));
    $registry = new CpfGeneratorRegistry();
    $registry->register($registryPath, ['generator_id'=>'low','version'=>'1.0.0','node_types'=>['chapter'],'capabilities'=>['draft'],'priority'=>1,'status'=>'ACTIVE']);
    $registry->register($registryPath, ['generator_id'=>'high','version'=>'1.1.0','node_types'=>['chapter'],'capabilities'=>['draft','candidate_revision'],'priority'=>10,'status'=>'ACTIVE']);
    $resolved = $registry->resolve($registryPath, 'chapter', null, ['candidate_revision']);
    t('generator registry resolve', $resolved['generator_id'] === 'high');

    $migration = new CpfMigrationManager();
    $state = $migration->status($root);
    t('new project migration state', $state['schema_version'] === 2);
    $legacy = $root . '_legacy';
    mkdir($legacy, 0777, true);
    file_put_contents($legacy . '/project.json', json_encode(['project_id'=>'LEGACY','title'=>'Legacy','schema_version'=>1]));
    $state = $migration->migrate($legacy, 2);
    t('migration framework', $state['schema_version'] === 2 && is_dir($legacy . '/revisions'));
    exec('rm -rf ' . escapeshellarg($legacy));

    $storyRoot = $root . '_story';
    (new CpfProjectManager())->create($storyRoot, 'CPF_STORY_TEST', 'Story Import');
    $storyInput = [
        'story_id' => 'STORY_GUILD', 'title' => 'ギルド冒険物語',
        'premise' => '王子が王都奪還を目指す。', 'ending_goal' => '王都奪還',
        'chapters' => [
            ['order'=>1,'title'=>'平原の章','theme'=>'王とは何か','summary'=>'王都襲撃','boss'=>'オークキング','joins'=>['レオン'],'milestones'=>['黒の結晶'],'locked_fields'=>['theme']],
            ['order'=>2,'title'=>'森林の章','theme'=>'民を知る','summary'=>'エルフの里救援','boss'=>'トレントエルダー','joins'=>['リーファ'],'milestones'=>['原因判明']],
        ],
    ];
    $imported = (new CpfStoryImporter())->import($storyRoot, $storyInput);
    t('story importer creates normalized nodes', $imported['chapter_count'] === 2 && count($imported['created_node_ids']) === 5);
    $importedChapter = (new CpfNodeManager())->get($storyRoot, 'CH001');
    t('story importer applies manual fields', in_array('theme', $importedChapter['manual_fields'], true));
    $analysis = (new CpfStoryStructureAnalyzer())->analyze($storyRoot, 'STORY_GUILD');
    t('story structure analyzer', $analysis['ok'] && $analysis['metrics']['theme_coverage_percent'] === 100.0 && $analysis['preview_rebuild_ready']);
    $sameImport = (new CpfStoryImporter())->import($storyRoot, $storyInput);
    t('story importer identical input is idempotent', ($sameImport['idempotent'] ?? false) && $sameImport['created_node_ids'] === [] && $sameImport['updated_node_ids'] === []);

    $reducedInput = $storyInput;
    $reducedInput['chapters'] = [$storyInput['chapters'][0]];
    $reduced = (new CpfStoryImporter())->import($storyRoot, $reducedInput, true);
    $archivedChapter = (new CpfNodeManager())->get($storyRoot, 'CH002');
    $archivedMilestone = (new CpfNodeManager())->get($storyRoot, 'CH002_MS001');
    t('story importer archives removed draft children', in_array('CH002', $reduced['archived_node_ids'], true) && $archivedChapter['status'] === 'ARCHIVED' && $archivedMilestone['status'] === 'ARCHIVED');
    $depsAfterReduction = (new CpfDependencyManager())->all($storyRoot);
    t('story importer removes stale dependencies', count(array_filter($depsAfterReduction, fn(array $d): bool => ($d['source_node_id'] ?? '') === 'CH002' || ($d['target_node_id'] ?? '') === 'CH002')) === 0);

    $restored = (new CpfStoryImporter())->import($storyRoot, $storyInput, true);
    $restoredChapter = (new CpfNodeManager())->get($storyRoot, 'CH002');
    t('story importer restores archived children on reimport', !($restored['idempotent'] ?? true) && $restoredChapter['status'] === 'DRAFT');

    (new CpfApprovalManager())->approve($storyRoot, 'CH002');
    $beforeRollback = (new CpfNodeManager())->get($storyRoot, 'STORY_GUILD');
    try { (new CpfStoryImporter())->import($storyRoot, $reducedInput, true); t('protected child removal rejected', false); }
    catch (CpfException $e) { t('protected child removal rejected', $e->errorCode === 'STORY_CHILD_PROTECTED'); }
    $afterRollback = (new CpfNodeManager())->get($storyRoot, 'STORY_GUILD');
    $protectedChapter = (new CpfNodeManager())->get($storyRoot, 'CH002');
    t('failed import rolls back all prior writes', $beforeRollback['version'] === $afterRollback['version'] && $afterRollback['payload']['chapter_count'] === 2 && $protectedChapter['status'] === 'APPROVED');

    @mkdir($storyRoot . '/locks/story-import.lock', 0777, true);
    file_put_contents($storyRoot . '/locks/story-import.lock/owner.json', json_encode(['created_unix' => time()]));
    $changedInput = $storyInput; $changedInput['premise'] .= ' changed';
    try { (new CpfStoryImporter())->import($storyRoot, $changedInput, true); t('concurrent import lock rejected', false); }
    catch (CpfException $e) { t('concurrent import lock rejected', $e->errorCode === 'STORY_IMPORT_LOCKED'); }
    exec('rm -rf ' . escapeshellarg($storyRoot . '/locks/story-import.lock'));

    $latestImport = json_decode((string)file_get_contents($storyRoot . '/imports/STORY_GUILD/latest.json'), true);
    t('import snapshots are revisioned and hashed', ($latestImport['revision'] ?? 0) === 3 && strlen((string)($latestImport['normalized_hash'] ?? '')) === 64 && is_file((string)($latestImport['snapshot_path'] ?? '')));
    exec('rm -rf ' . escapeshellarg($storyRoot));

    $validation = (new CpfValidator())->validate($root);
    t('project validation', $validation['ok'] && $validation['node_count'] === 3);
} finally {
    exec('rm -rf ' . escapeshellarg($root));
}
exit($fail ? 1 : 0);
