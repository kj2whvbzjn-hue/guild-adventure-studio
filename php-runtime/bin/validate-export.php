#!/usr/bin/env php
<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use GK\Export\ExportLoader;
use GK\Export\RuntimeErrorReporter;

$directory = $argv[1] ?? dirname(__DIR__, 2) . '/Export';
$logFile = getenv('GK_EXPORT_ERROR_LOG') ?: null;
$reporter = new RuntimeErrorReporter($logFile);

try {
    $package = (new ExportLoader(['1.0.0']))->load($directory);
    echo json_encode([
        'ok' => true,
        'schema_version' => $package->manifest['schema_version'] ?? null,
        'data_version' => $package->manifest['data_version'] ?? null,
        'file_count' => count($package->paths()),
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    $incidentId = $reporter->writeLog($e);
    fwrite(STDERR, json_encode(
        $reporter->adminPayload($e, $incidentId),
        JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE
    ) . PHP_EOL);
    exit($e instanceof GK\Export\ExportLoadException ? 1 : 2);
}
