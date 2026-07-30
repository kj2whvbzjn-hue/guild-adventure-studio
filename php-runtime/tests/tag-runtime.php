#!/usr/bin/env php
<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/bootstrap.php';

use GK\Export\ExportLoadException;
use GK\Export\RuntimeTagReferenceValidator;
use GK\Export\RuntimeTagRegistry;

$failures = 0;
function check(string $name, bool $ok): void { global $failures; echo ($ok ? '[PASS] ' : '[FAIL] ') . $name . PHP_EOL; if (!$ok) { $failures++; } }

$project = [
    'tag_categories' => [['id'=>'CAT-ELEMENT','name'=>'属性','color'=>'#fff','enabled'=>true]],
    'tags' => [
        ['id'=>'FIRE','name'=>'火','aliases'=>['炎'],'parent_id'=>'','category_id'=>'CAT-ELEMENT','locked'=>true,'deprecated'=>false,'replacement_tag_id'=>''],
        ['id'=>'FLAME','name'=>'火炎','aliases'=>[],'parent_id'=>'FIRE','category_id'=>'CAT-ELEMENT','locked'=>false,'deprecated'=>true,'replacement_tag_id'=>'FIRE'],
    ],
    'masters' => ['skills' => [['id'=>'SK001','name'=>'火球','tags'=>['FIRE']]]],
];

try {
    $registry = RuntimeTagRegistry::fromStudioProject($project);
    check('loads GK STUDIO tag master', count($registry->tags()) === 2 && count($registry->categories()) === 1);
    check('resolves exact tag ID', $registry->resolveId('FIRE') === 'FIRE');
    check('resolves tag name and alias', $registry->resolveId('火') === 'FIRE' && $registry->resolveId('炎') === 'FIRE');
    check('keeps parent relation without inheritance', $registry->children('FIRE') === ['FLAME'] && !$registry->has('CAT-ELEMENT'));
    check('exposes deprecated replacement', $registry->isDeprecated('FLAME') && $registry->replacementId('FLAME') === 'FIRE');
    check('valid project references pass', (new RuntimeTagReferenceValidator())->validate($project, $registry) === []);
    $broken = $project; $broken['masters']['skills'][0]['tags'][] = 'UNKNOWN';
    $issues = (new RuntimeTagReferenceValidator())->validate($broken, $registry);
    check('unknown runtime tag reference is reported', count($issues) === 1 && $issues[0]['tag_id'] === 'UNKNOWN');
} catch (Throwable $e) {
    check('tag runtime integration', false); echo $e->getMessage() . PHP_EOL;
}

try {
    RuntimeTagRegistry::fromStudioProject(['tag_categories'=>[], 'tags'=>[['id'=>'A','name'=>'A','aliases'=>[],'parent_id'=>'B'],['id'=>'B','name'=>'B','aliases'=>[],'parent_id'=>'A']]]);
    check('parent cycle is rejected', false);
} catch (ExportLoadException $e) { check('parent cycle is rejected', $e->errorCode === 'TAG_PARENT_CYCLE'); }

exit($failures === 0 ? 0 : 1);
