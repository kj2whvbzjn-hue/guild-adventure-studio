<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use GK\CPF\Core\{CpfNodeManager, CpfException};
use GK\CPF\Revision\CpfRevisionRepository;

function failTest(string $message): never {
    fwrite(STDERR, "[FAIL] $message\n");
    exit(1);
}
function removeTree(string $dir): void {
    if (!is_dir($dir)) return;
    foreach (array_diff(scandir($dir) ?: [], ['.', '..']) as $item) {
        $path = $dir . '/' . $item;
        is_dir($path) && !is_link($path) ? removeTree($path) : @unlink($path);
    }
    @rmdir($dir);
}

$dir = sys_get_temp_dir() . '/cpf-revision-mutation-' . bin2hex(random_bytes(4));
mkdir($dir, 0777, true);
$nodes = new CpfNodeManager();
$revisions = new CpfRevisionRepository();

try {
    $nodes->create($dir, 'NODE_A', 'story', ['title' => 'Base']);
    $first = $revisions->createCandidate($dir, 'NODE_A', ['payload' => ['title' => 'Candidate 1']], 'first');
    if (($first['revision_id'] ?? '') !== 'REV_NODE_A_000001') failTest('first revision id');

    // 欠番があっても最大IDの次を採番し、IDを再利用しないこと。
    $gap = $first;
    $gap['revision_id'] = 'REV_NODE_A_000005';
    file_put_contents($dir . '/revisions/NODE_A/REV_NODE_A_000005.json', json_encode($gap, JSON_PRETTY_PRINT) . "\n");
    $next = $revisions->createCandidate($dir, 'NODE_A', ['payload' => ['title' => 'Candidate 2']], 'second');
    if (($next['revision_id'] ?? '') !== 'REV_NODE_A_000006') failTest('max-based revision id');

    // History書込み前に失敗しても、新規Revisionが残らないこと。
    $historyPath = $dir . '/history/history.json';
    $validHistory = file_get_contents($historyPath);
    file_put_contents($historyPath, "{invalid json\n");
    try {
        $revisions->createCandidate($dir, 'NODE_A', ['payload' => ['title' => 'Must rollback']], 'rollback create');
        failTest('create rollback exception not raised');
    } catch (CpfException $error) {
        if ($error->getMessage() !== "Invalid JSON: $historyPath") throw $error;
    }
    if (is_file($dir . '/revisions/NODE_A/REV_NODE_A_000007.json')) failTest('failed candidate remained');
    if (file_get_contents($historyPath) !== "{invalid json\n") failTest('history backup not restored after create failure');
    file_put_contents($historyPath, $validHistory);

    // Promotion途中のHistory失敗でNodeとRevisionの両方が復元されること。
    $candidate = $revisions->createCandidate($dir, 'NODE_A', ['payload' => ['title' => 'Promote me']], 'promotion');
    $revisionId = $candidate['revision_id'];
    $nodeBefore = file_get_contents($dir . '/nodes/NODE_A.json');
    $revisionBefore = file_get_contents($dir . '/revisions/NODE_A/' . $revisionId . '.json');
    file_put_contents($historyPath, "{invalid json\n");
    try {
        $revisions->approveAndPromote($dir, 'NODE_A', $revisionId, 'tester');
        failTest('promotion rollback exception not raised');
    } catch (CpfException $error) {
        if ($error->getMessage() !== "Invalid JSON: $historyPath") throw $error;
    }
    if (file_get_contents($dir . '/nodes/NODE_A.json') !== $nodeBefore) failTest('node not restored after promotion failure');
    if (file_get_contents($dir . '/revisions/NODE_A/' . $revisionId . '.json') !== $revisionBefore) failTest('revision not restored after promotion failure');

    echo "[PASS] revision max-id allocation\n";
    echo "[PASS] candidate creation rollback\n";
    echo "[PASS] promotion rollback\n";
} finally {
    removeTree($dir);
}
