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


// Current Skill Export must use the same package envelope; no independent/migration envelope is accepted.
try {
    $package = (new ExportLoader(['1.0.0']))->load($exportPath);
    $skill = $package->document('skill/skills.json');
    gateReport(
        'skill Export uses current package envelope',
        ($skill['schema_version'] ?? null) === ($package->manifest['schema_version'] ?? null)
        && ($skill['data_version'] ?? null) === ($package->manifest['data_version'] ?? null)
        && !array_key_exists('migration', $skill)
    );
} catch (Throwable $e) {
    gateReport('skill Export uses current package envelope', false, $e->getMessage());
}

// The PHP Runtime suites themselves are protected and release-gating.
try {
    $policy = json_decode((string)file_get_contents(dirname(__DIR__) . '/shared/integrity/test-integrity-policy.json'), true, 512, JSON_THROW_ON_ERROR);
    $registry = json_decode((string)file_get_contents(dirname(__DIR__) . '/shared/tests/test-registry.json'), true, 512, JSON_THROW_ON_ERROR);
    $protected = in_array('php-runtime/tests/**', $policy['protected_patterns'] ?? [], true);
    $active = array_column($registry['release_gate'] ?? [], 'path');
    gateReport(
        'PHP Runtime tests are protected and release-gating',
        $protected
        && in_array('php-runtime/tests/run.php', $active, true)
        && in_array('php-runtime/tests/tag-runtime.php', $active, true)
    );
} catch (Throwable $e) {
    gateReport('PHP Runtime tests are protected and release-gating', false, $e->getMessage());
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
