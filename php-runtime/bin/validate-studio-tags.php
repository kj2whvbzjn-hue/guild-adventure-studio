#!/usr/bin/env php
<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use GK\Export\RuntimeTagReferenceValidator;
use GK\Export\RuntimeTagRegistry;
use GK\Export\RuntimeErrorReporter;

$path = $argv[1] ?? '';
if ($path === '' || !is_file($path)) {
    fwrite(STDERR, "Usage: php validate-studio-tags.php <gk-studio-project.json>\n");
    exit(2);
}

try {
    $raw = file_get_contents($path);
    if ($raw === false) { throw new RuntimeException('File could not be read.'); }
    $project = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($project) || array_is_list($project)) { throw new RuntimeException('Project root must be an object.'); }
    $registry = RuntimeTagRegistry::fromStudioProject($project);
    $issues = (new RuntimeTagReferenceValidator())->validate($project, $registry);
    echo json_encode([
        'ok' => $issues === [],
        'tag_categories' => count($registry->categories()),
        'tags' => count($registry->tags()),
        'issues' => $issues,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
    exit($issues === [] ? 0 : 1);
} catch (Throwable $e) {
    RuntimeErrorReporter::report($e);
    exit(1);
}
