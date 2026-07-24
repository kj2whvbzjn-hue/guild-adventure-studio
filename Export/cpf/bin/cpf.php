#!/usr/bin/env php
<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use GK\CPF\Approval\CpfApprovalManager;
use GK\CPF\Core\{CpfException, CpfNodeManager, CpfProjectManager, CpfRegenerationManager};
use GK\CPF\Dependency\CpfDependencyManager;
use GK\CPF\Generation\CpfGeneratorRegistry;
use GK\CPF\Migration\CpfMigrationManager;
use GK\CPF\Revision\CpfRevisionRepository;
use GK\CPF\Validation\CpfValidator;
use GK\CPF\Workflow\CpfWorkflowManager;
use GK\CPF\Story\{CpfStoryImporter, CpfStoryStructureAnalyzer};

function out(mixed $value): void { echo json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"; }
function jsonArg(string $value): array {
    $decoded = json_decode($value, true);
    if (!is_array($decoded)) throw new CpfException('INPUT_INVALID', 'Expected JSON object');
    return $decoded;
}

$args = $argv;
array_shift($args);
$command = array_shift($args) ?? 'help';
try {
    switch ($command) {
        case 'project:create': [$dir, $id, $title] = $args + ['', '', '']; out((new CpfProjectManager())->create($dir, $id, $title)); break;
        case 'node:create': [$dir, $id, $type, $payload] = $args + ['', '', '', '{}']; out((new CpfNodeManager())->create($dir, $id, $type, jsonArg($payload))); break;
        case 'node:update': [$dir, $id, $patch, $reason] = $args + ['', '', '{}', '']; out((new CpfNodeManager())->update($dir, $id, jsonArg($patch), $reason)); break;
        case 'node:get': out((new CpfNodeManager())->get($args[0], $args[1])); break;
        case 'node:list': out((new CpfNodeManager())->all($args[0])); break;
        case 'approve': out((new CpfApprovalManager())->approve($args[0], $args[1], $args[2] ?? 'user')); break;
        case 'reject': out((new CpfApprovalManager())->reject($args[0], $args[1], $args[2] ?? '')); break;
        case 'lock': out((new CpfNodeManager())->lock($args[0], $args[1], $args[2] ?? '')); break;
        case 'unlock': out((new CpfNodeManager())->unlock($args[0], $args[1], $args[2] ?? '')); break;
        case 'dependency:add': out((new CpfDependencyManager())->add($args[0], $args[1], $args[2], $args[3], $args[4])); break;
        case 'impact': out((new CpfDependencyManager())->impact($args[0], $args[1])); break;
        case 'regenerate:request': out((new CpfRegenerationManager())->request($args[0], $args[1], $args[2] ?? '')); break;
        case 'revision:create': out((new CpfRevisionRepository())->createCandidate($args[0], $args[1], jsonArg($args[2] ?? '{}'), $args[3] ?? '')); break;
        case 'revision:list': out((new CpfRevisionRepository())->list($args[0], $args[1])); break;
        case 'revision:approve': out((new CpfRevisionRepository())->approveAndPromote($args[0], $args[1], $args[2], $args[3] ?? 'user')); break;
        case 'revision:reject': out((new CpfRevisionRepository())->reject($args[0], $args[1], $args[2], $args[3] ?? '')); break;
        case 'workflow:validate': $errors = (new CpfWorkflowManager())->validateGraph($args[0]); out(['ok' => $errors === [], 'errors' => $errors]); exit($errors === [] ? 0 : 1);
        case 'generator:list': out((new CpfGeneratorRegistry())->all($args[0])); break;
        case 'generator:register': out((new CpfGeneratorRegistry())->register($args[0], jsonArg($args[1] ?? '{}'))); break;
        case 'generator:unregister': out(['removed' => (new CpfGeneratorRegistry())->unregister($args[0], $args[1], $args[2] ?? null)]); break;
        case 'generator:resolve': out((new CpfGeneratorRegistry())->resolve($args[0], $args[1], $args[2] ?? null, isset($args[3]) ? jsonArg($args[3]) : [])); break;
        case 'migration:status': out((new CpfMigrationManager())->status($args[0])); break;
        case 'migration:run': out((new CpfMigrationManager())->migrate($args[0], (int)$args[1])); break;
        case 'story:import': out((new CpfStoryImporter())->importFile($args[0], $args[1], ($args[2] ?? '') === '--replace-drafts')); break;
        case 'story:analyze': $result = (new CpfStoryStructureAnalyzer())->analyze($args[0], $args[1]); out($result); exit($result['ok'] ? 0 : 2);
        case 'validate': $result = (new CpfValidator())->validate($args[0]); out($result); exit($result['ok'] ? 0 : 1);
        default:
            echo "CPF CLI commands: project:create, node:create, node:update, node:get, node:list, approve, reject, lock, unlock, dependency:add, impact, regenerate:request, revision:create, revision:list, revision:approve, revision:reject, workflow:validate, generator:list, generator:register, generator:unregister, generator:resolve, migration:status, migration:run, story:import, story:analyze, validate\n";
    }
} catch (CpfException $e) {
    fwrite(STDERR, json_encode(['ok' => false, 'error_code' => $e->errorCode, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE) . "\n");
    exit($e->exitCode);
} catch (Throwable $e) {
    fwrite(STDERR, json_encode(['ok' => false, 'error_code' => 'INTERNAL_ERROR', 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE) . "\n");
    exit(1);
}
