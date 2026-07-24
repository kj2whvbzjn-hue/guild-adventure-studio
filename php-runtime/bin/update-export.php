#!/usr/bin/env php
<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/bootstrap.php';

use GK\Export\AtomicExportUpdater;
use GK\Export\ExportLoadException;

$candidate = $argv[1] ?? '';
$target = $argv[2] ?? '';
if ($candidate === '' || $target === '') {
    fwrite(STDERR, "Usage: php php-runtime/bin/update-export.php <candidate-export> <live-export>\n");
    exit(2);
}
try {
    $package = (new AtomicExportUpdater())->update($candidate, $target);
    fwrite(STDOUT, 'Atomic update completed: ' . count($package->paths()) . " files\n");
    exit(0);
} catch (ExportLoadException $e) {
    fwrite(STDERR, '[' . $e->errorCode . '] ' . $e->getMessage() . "\n");
    exit(1);
}
