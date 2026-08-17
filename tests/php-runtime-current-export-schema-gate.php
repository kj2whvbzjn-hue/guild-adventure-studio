#!/usr/bin/env php
<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/php-runtime/bootstrap.php';

use GK\Export\ExportLoader;
use GK\Export\ExportLoadException;
use GK\Export\SimpleSchemaValidator;

$failures = 0;

function gateReport(string $name, bool $ok, string $detail = ''): void
{
    global $failures;
    echo ($ok ? '[PASS] ' : '[FAIL] ') . $name . ($detail !== '' ? ' - ' . $detail : '') . PHP_EOL;
    if (!$ok) {
        $failures++;
    }
}

$exportPath = dirname(__DIR__) . '/Export';

try {
    $package = (new ExportLoader(['1.0.0']))->load($exportPath);
    gateReport(
        'current Export loads through PHP Runtime',
        count($package->paths()) > 0 && in_array('ai/ai_nodes.json', $package->paths(), true),
        'loaded ' . count($package->paths()) . ' files'
    );
} catch (Throwable $e) {
    gateReport('current Export loads through PHP Runtime', false, $e->getMessage());
}

$validator = new SimpleSchemaValidator();

$validCases = [
    ['value' => null, 'schema' => ['type' => ['string', 'null']], 'name' => 'nullable string accepts null'],
    ['value' => 'EVT-001', 'schema' => ['type' => ['string', 'null']], 'name' => 'nullable string accepts string'],
    ['value' => 3, 'schema' => ['type' => ['number', 'integer', 'null']], 'name' => 'numeric union accepts integer'],
    ['value' => 3.5, 'schema' => ['type' => ['number', 'integer', 'null']], 'name' => 'numeric union accepts number'],
    ['value' => ['id' => 'AI-001'], 'schema' => ['type' => ['object', 'null']], 'name' => 'nullable object accepts object'],
];

foreach ($validCases as $case) {
    try {
        $validator->validate($case['value'], $case['schema']);
        gateReport($case['name'], true);
    } catch (Throwable $e) {
        gateReport($case['name'], false, $e->getMessage());
    }
}

try {
    $validator->validate(true, ['type' => ['string', 'null']]);
    gateReport('invalid union type is rejected', false, 'boolean was accepted');
} catch (ExportLoadException $e) {
    gateReport('invalid union type is rejected', $e->errorCode === 'DATA_SCHEMA_INVALID', $e->errorCode);
} catch (Throwable $e) {
    gateReport('invalid union type is rejected', false, get_class($e) . ': ' . $e->getMessage());
}

exit($failures === 0 ? 0 : 1);
