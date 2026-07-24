#!/usr/bin/env php
<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/bootstrap.php';
use GK\Export\ExportLoader;
use GK\Export\GameValidationReporter;
use GK\Export\RuntimeErrorReporter;

$args = array_slice($argv, 1);
$strict = in_array('--strict-orphans', $args, true);
$args = array_values(array_filter($args, fn(string $v): bool => $v !== '--strict-orphans'));
$directory = $args[0] ?? dirname(__DIR__, 2) . '/Export';
$reporter = new RuntimeErrorReporter(getenv('GK_EXPORT_ERROR_LOG') ?: null);
try {
    $package = (new ExportLoader(['1.0.0']))->load($directory);
    echo json_encode((new GameValidationReporter())->generate($package, $strict), JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT) . PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    $incidentId = $reporter->writeLog($e);
    fwrite(STDERR, json_encode($reporter->adminPayload($e, $incidentId), JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_INVALID_UTF8_SUBSTITUTE) . PHP_EOL);
    exit($e instanceof GK\Export\ExportLoadException ? 1 : 2);
}
