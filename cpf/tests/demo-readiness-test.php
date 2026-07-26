<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use GK\CPF\Core\CpfNodeManager;
use GK\CPF\Approval\CpfApprovalManager;
use GK\CPF\Dependency\CpfDependencyManager;
use GK\CPF\Demo\CpfDemoReadinessGate;

function failDemoTest(string $message): never { fwrite(STDERR, "[FAIL] $message\n"); exit(1); }
function removeDemoTree(string $dir): void {
    if (!is_dir($dir)) return;
    foreach (array_diff(scandir($dir) ?: [], ['.', '..']) as $item) {
        $path = $dir . '/' . $item;
        is_dir($path) && !is_link($path) ? removeDemoTree($path) : @unlink($path);
    }
    @rmdir($dir);
}

$dir = sys_get_temp_dir() . '/cpf-demo-readiness-' . bin2hex(random_bytes(4));
mkdir($dir, 0777, true);
$nodes = new CpfNodeManager();
$approval = new CpfApprovalManager();
$deps = new CpfDependencyManager();
$gate = new CpfDemoReadinessGate();

try {
    $empty = $gate->evaluate($dir);
    if (($empty['ok'] ?? true) !== false) failDemoTest('empty project must be blocked');
    if (count($empty['blocking_issues'] ?? []) !== 11) failDemoTest('empty project blocking count');

    $definitions = [
        ['STORY_DEMO', 'story', ['title' => 'Demo Story']],
        ['PLOT_DEMO', 'plot', ['title' => 'Demo Plot']],
        ['CH_DEMO', 'chapter', ['title' => 'Demo Chapter']],
        ['SEC_DEMO', 'section', ['title' => 'Demo Section']],
        ['SCN_DEMO', 'scene', ['title' => 'Demo Scene', 'text' => 'Demo text']],
        ['EV_DEMO', 'event', ['title' => 'Demo Event']],
    ];
    foreach ($definitions as [$id, $type, $payload]) {
        $nodes->create($dir, $id, $type, $payload);
        $approval->approve($dir, $id, 'test-user');
    }

    $deps->add($dir, 'STORY_DEMO', 'PLOT_DEMO', 'GENERATES', 'HIGH');
    $deps->add($dir, 'PLOT_DEMO', 'CH_DEMO', 'GENERATES', 'HIGH');
    $deps->add($dir, 'CH_DEMO', 'SEC_DEMO', 'GENERATES', 'HIGH');
    $deps->add($dir, 'SEC_DEMO', 'SCN_DEMO', 'GENERATES', 'HIGH');
    $deps->add($dir, 'SCN_DEMO', 'EV_DEMO', 'GENERATES', 'HIGH');

    $ready = $gate->evaluate($dir);
    if (($ready['ok'] ?? false) !== true) failDemoTest('complete approved path must pass');
    if (($ready['blocking_issues'] ?? []) !== []) failDemoTest('ready path has blocking issues');
    if (count($ready['connected_edges'] ?? []) !== 5) failDemoTest('connected edge count');

    $nodes->setStatus($dir, 'EV_DEMO', 'REJECTED', [], 'test rejection');
    $blocked = $gate->evaluate($dir);
    if (($blocked['ok'] ?? true) !== false) failDemoTest('rejected event must block');

    echo "[PASS] empty demo readiness is blocked\n";
    echo "[PASS] approved minimum playable path passes\n";
    echo "[PASS] rejected required node blocks readiness\n";
} finally {
    removeDemoTree($dir);
}
