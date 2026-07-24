<?php
declare(strict_types=1);
$map = [
    'cpf-project.php' => 'project:create',
    'cpf-approve.php' => 'approve',
    'cpf-reject.php' => 'reject',
    'cpf-lock.php' => 'lock',
    'cpf-unlock.php' => 'unlock',
    'cpf-impact.php' => 'impact',
    'cpf-validate.php' => 'validate',
    'cpf-regenerate.php' => 'regenerate:request',
    'cpf-story-import.php' => 'story:import',
    'cpf-story-analyze.php' => 'story:analyze',
];
$name = basename($_SERVER['SCRIPT_FILENAME'] ?? '');
$command = $map[$name] ?? null;
if ($command === null) { fwrite(STDERR, "Unsupported wrapper\n"); exit(1); }
$script = __DIR__ . '/cpf.php';
$args = array_slice($argv, 1);
$escaped = array_map('escapeshellarg', array_merge([PHP_BINARY, $script, $command], $args));
passthru(implode(' ', $escaped), $exitCode);
exit($exitCode);
