#!/usr/bin/env php
<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use GK\Export\ExportLoader;
use GK\Export\ExportLoadException;
use GK\Export\RuntimeErrorReporter;
use GK\Export\GameMasterRepository;
use GK\Export\AtomicExportUpdater;

$source = $argv[1] ?? dirname(__DIR__, 2) . '/Export';
$failures = 0;

function report(string $name, bool $ok, string $detail = ''): void {
    global $failures;
    echo ($ok ? '[PASS] ' : '[FAIL] ') . $name . ($detail !== '' ? " - {$detail}" : '') . PHP_EOL;
    if (!$ok) { $failures++; }
}

function copyTree(string $src, string $dst): void {
    mkdir($dst, 0777, true);
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($src, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
    foreach ($it as $item) {
        $target = $dst . DIRECTORY_SEPARATOR . $it->getSubPathName();
        if ($item->isDir()) { mkdir($target, 0777, true); }
        else { copy($item->getPathname(), $target); }
    }
}


function rewriteJsonAndManifest(string $tmp, string $rel, callable $change): void {
    $file=$tmp . '/' . $rel;
    $doc=json_decode((string)file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
    $change($doc);
    file_put_contents($file, json_encode($doc, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT) . "\n");
    $mp=$tmp . '/manifest.json';
    $m=json_decode((string)file_get_contents($mp), true, 512, JSON_THROW_ON_ERROR);
    foreach($m['files'] as &$entry){ if($entry['path']===$rel){$entry['sha256']=hash_file('sha256',$file);break;} } unset($entry);
    file_put_contents($mp, json_encode($m, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT) . "\n");
}


function rewriteRawAndManifest(string $tmp, string $rel, string $raw): void {
    $file = $tmp . '/' . $rel;
    file_put_contents($file, $raw);
    $mp = $tmp . '/manifest.json';
    $m = json_decode((string)file_get_contents($mp), true, 512, JSON_THROW_ON_ERROR);
    foreach ($m['files'] as &$entry) {
        if ($entry['path'] === $rel) { $entry['sha256'] = hash_file('sha256', $file); break; }
    }
    unset($entry);
    file_put_contents($mp, json_encode($m, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
}

function expectError(string $name, string $source, callable $mutate, string $expectedCode): void {
    $tmp = sys_get_temp_dir() . '/gk-export-test-' . bin2hex(random_bytes(6));
    copyTree($source, $tmp);
    try {
        $mutate($tmp);
        (new ExportLoader(['1.0.0']))->load($tmp);
        report($name, false, 'expected ' . $expectedCode . ', no exception');
    } catch (ExportLoadException $e) {
        report($name, $e->errorCode === $expectedCode, 'received ' . $e->errorCode);
    } finally {
        if (is_dir($tmp)) {
            $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($tmp, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
            foreach ($it as $item) { $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname()); }
            rmdir($tmp);
        }
    }
}


function expectLoaderError(string $name, callable $loaderFactory, string $source, string $expectedCode): void {
    try {
        $loader = $loaderFactory();
        if (!$loader instanceof ExportLoader) {
            report($name, false, 'factory did not return ExportLoader');
            return;
        }
        $loader->load($source);
        report($name, false, 'expected ' . $expectedCode . ', no exception');
    } catch (ExportLoadException $e) {
        report($name, $e->errorCode === $expectedCode, 'received ' . $e->errorCode);
    }
}

try {
    $pkg = (new ExportLoader(['1.0.0']))->load($source);
    report('valid package loads', count($pkg->paths()) === 22, 'loaded ' . count($pkg->paths()) . ' files');
} catch (Throwable $e) {
    report('valid package loads', false, $e->getMessage());
}


$repositoryFixture = sys_get_temp_dir() . '/gk-repository-fixture-' . bin2hex(random_bytes(6));
copyTree($source, $repositoryFixture);
try {
    rewriteJsonAndManifest($repositoryFixture, 'scenario/chapters.json', function(array &$doc): void {
        $doc['data'] = [['id' => 'CH001', 'name' => '平原の章']];
    });
    rewriteJsonAndManifest($repositoryFixture, 'monster/monsters.json', function(array &$doc): void {
        $doc['data'] = [['id' => 'MON001', 'name' => 'スライム']];
    });
    rewriteJsonAndManifest($repositoryFixture, 'system/game_settings.json', function(array &$doc): void {
        $doc['data'] = ['party_size' => 6];
    });
    rewriteJsonAndManifest($repositoryFixture, 'system/balance.json', function(array &$doc): void {
        $doc['data'] = ['agi_threshold' => 100];
    });

    $pkg = (new ExportLoader(['1.0.0']))->load($repositoryFixture);
    $repo = new GameMasterRepository($pkg);
    report('repository exposes all record collections', count(GameMasterRepository::COLLECTION_PATHS) === 20);
    report('repository finds generated chapter by id', ($repo->chapters()->require('CH001')['name'] ?? '') === '平原の章');
    report('repository finds generated monster by id', ($repo->monsters()->find('MON001')['name'] ?? '') === 'スライム');
    report('repository exposes object settings', ($repo->gameSettings()['party_size'] ?? null) === 6 && ($repo->balance()['agi_threshold'] ?? null) === 100);
    report('repository returns null for optional lookup', $repo->equipment()->find('EQ999') === null);
    try { $repo->equipment()->require('EQ999'); report('repository required lookup rejects missing id', false); }
    catch (ExportLoadException $e) { report('repository required lookup rejects missing id', $e->errorCode === 'RECORD_NOT_FOUND'); }
    try { $repo->collection('unknown'); report('repository rejects unknown collection', false); }
    catch (ExportLoadException $e) { report('repository rejects unknown collection', $e->errorCode === 'REPOSITORY_COLLECTION_UNKNOWN'); }
} catch (Throwable $e) {
    report('repository integration', false, $e->getMessage());
} finally {
    if (is_dir($repositoryFixture)) {
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($repositoryFixture, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($it as $item) { $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname()); }
        rmdir($repositoryFixture);
    }
}

(function () use ($source): void {
    if (!function_exists('symlink')) {
        report('symbolic-link security tests', true, 'skipped: symlink unavailable');
        return;
    }

    $cases = [
        'manifest symbolic link is rejected' => function (string $tmp): bool {
            $real = $tmp . '/manifest-real.json';
            if (!rename($tmp . '/manifest.json', $real)) { return false; }
            return @symlink('manifest-real.json', $tmp . '/manifest.json');
        },
        'document symbolic link is rejected' => function (string $tmp): bool {
            $real = $tmp . '/master/jobs-real.json';
            if (!rename($tmp . '/master/jobs.json', $real)) { return false; }
            return @symlink('jobs-real.json', $tmp . '/master/jobs.json');
        },
        'directory symbolic link is rejected' => function (string $tmp): bool {
            $real = $tmp . '/master-real';
            if (!rename($tmp . '/master', $real)) { return false; }
            return @symlink('master-real', $tmp . '/master');
        },
    ];

    foreach ($cases as $name => $createLink) {
        $tmp = sys_get_temp_dir() . '/gk-export-symlink-' . bin2hex(random_bytes(6));
        copyTree($source, $tmp);
        try {
            if (!$createLink($tmp)) {
                report($name, true, 'skipped: symlink creation not permitted');
                continue;
            }
            (new ExportLoader(['1.0.0']))->load($tmp);
            report($name, false, 'expected SYMLINK_FORBIDDEN, no exception');
        } catch (ExportLoadException $e) {
            report($name, $e->errorCode === 'SYMLINK_FORBIDDEN', 'received ' . $e->errorCode);
        } finally {
            if (is_dir($tmp)) {
                $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($tmp, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
                foreach ($it as $item) { $item->isDir() && !$item->isLink() ? rmdir($item->getPathname()) : unlink($item->getPathname()); }
                rmdir($tmp);
            }
        }
    }
})();

expectError('missing required file stops startup', $source, function (string $tmp): void {
    unlink($tmp . '/master/jobs.json');
}, 'MANIFEST_MISSING_FILE');

expectError('tampered file stops startup', $source, function (string $tmp): void {
    file_put_contents($tmp . '/master/jobs.json', "{}\n");
}, 'HASH_MISMATCH');

expectError('unsupported schema stops startup', $source, function (string $tmp): void {
    $p = $tmp . '/manifest.json';
    $m = json_decode((string)file_get_contents($p), true, 512, JSON_THROW_ON_ERROR);
    $m['schema_version'] = '9.0.0';
    file_put_contents($p, json_encode($m, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
}, 'SCHEMA_VERSION_UNSUPPORTED');

expectError('path traversal is rejected', $source, function (string $tmp): void {
    $p = $tmp . '/manifest.json';
    $m = json_decode((string)file_get_contents($p), true, 512, JSON_THROW_ON_ERROR);
    $m['files'][0]['path'] = '../outside.json';
    file_put_contents($p, json_encode($m, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
}, 'UNSAFE_PATH');


expectError('empty id is rejected by data schema', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'master/jobs.json', function(array &$doc):void{$doc['data']=[['id'=>'','name'=>'騎士']];});
}, 'DATA_SCHEMA_INVALID');

expectError('wrong field type is rejected by data schema', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'master/jobs.json', function(array &$doc):void{$doc['data']=[['id'=>'JOB001','name'=>'騎士','str'=>'11']];});
}, 'DATA_SCHEMA_INVALID');

expectError('negative known numeric value is rejected', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'skill/skills.json', function(array &$doc):void{$doc['data']=[['id'=>'SK001','name'=>'斬撃','power'=>-1]];});
}, 'DATA_SCHEMA_INVALID');

expectError('document schema_version must match manifest', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'master/jobs.json', function(array &$doc):void{$doc['schema_version']='1.0.1';});
}, 'SCHEMA_VERSION_MISMATCH');

expectError('document data_version must match manifest', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'master/jobs.json', function(array &$doc):void{$doc['data_version']='e2e-9.9.9';});
}, 'DATA_VERSION_MISMATCH');

expectError('document generated_at must match manifest', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'master/jobs.json', function(array &$doc):void{$doc['generated_at']='2026-07-23T22:00:00+09:00';});
}, 'GENERATED_AT_MISMATCH');

expectError('document generated_by must match manifest', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'master/jobs.json', function(array &$doc):void{$doc['generated_by']='GK Studio v0.0.0';});
}, 'GENERATED_BY_MISMATCH');


expectError('manifest must contain exact official 22 paths', $source, function (string $tmp): void {
    $p = $tmp . '/manifest.json';
    $m = json_decode((string)file_get_contents($p), true, 512, JSON_THROW_ON_ERROR);
    $m['files'] = array_values(array_filter($m['files'], fn(array $e): bool => $e['path'] !== 'skill/skills.json'));
    file_put_contents($p, json_encode($m, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
}, 'MANIFEST_UNKNOWN_FILE');

expectError('official paths must be required', $source, function (string $tmp): void {
    $p = $tmp . '/manifest.json';
    $m = json_decode((string)file_get_contents($p), true, 512, JSON_THROW_ON_ERROR);
    foreach ($m['files'] as &$entry) { if ($entry['path'] === 'skill/skills.json') { $entry['required'] = false; break; } } unset($entry);
    file_put_contents($p, json_encode($m, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
}, 'OFFICIAL_PATH_NOT_REQUIRED');

expectError('duplicate ID in one file is rejected', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'master/jobs.json', function(array &$doc):void{
        $doc['data'] = [['id'=>'JOB001','name'=>'騎士'],['id'=>'JOB001','name'=>'重複職業']];
    });
}, 'DUPLICATE_ID');

expectError('duplicate ID across MOD group is rejected', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'equipment/mods.json', function(array &$doc):void{
        $doc['data'] = [['id'=>'MOD001','name'=>'装備MOD']];
    });
    rewriteJsonAndManifest($tmp, 'monster/monster_mods.json', function(array &$doc):void{
        $doc['data'] = [['id'=>'MOD001','name'=>'重複MOD','tags'=>['monster']]];
    });
}, 'DUPLICATE_ID_GROUP');

expectError('missing chapter reference is rejected', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'scenario/sections.json', function(array &$doc):void{
        $doc['data'] = [['id'=>'SEC001','name'=>'節','chapter_id'=>'CH999']];
    });
}, 'REFERENCE_NOT_FOUND');

expectError('missing equipment MOD reference is rejected', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'equipment/equipment.json', function(array &$doc):void{
        $doc['data'] = [['id'=>'EQ001','name'=>'剣','mod_ids'=>['MOD999']]];
    });
}, 'REFERENCE_NOT_FOUND');

expectError('missing quest monster reference is rejected', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'quest/main_quests.json', function(array &$doc):void{
        $doc['data'] = [['id'=>'MQ001','name'=>'依頼','monster_id'=>'MON999']];
    });
}, 'REFERENCE_NOT_FOUND');


expectError('unregistered file in Export stops startup', $source, function (string $tmp): void {
    file_put_contents($tmp . '/unexpected.json', "{}\n");
}, 'MANIFEST_UNKNOWN_FILE');

expectError('missing manifest stops startup', $source, function (string $tmp): void {
    unlink($tmp . '/manifest.json');
}, 'MANIFEST_MISSING');

expectError('manifest root must be an object', $source, function (string $tmp): void {
    file_put_contents($tmp . '/manifest.json', "[]\n");
}, 'JSON_ROOT_INVALID');

expectError('broken manifest JSON is rejected', $source, function (string $tmp): void {
    file_put_contents($tmp . '/manifest.json', "{broken\n");
}, 'JSON_INVALID');

expectError('manifest unsupported field is rejected', $source, function (string $tmp): void {
    $p = $tmp . '/manifest.json';
    $m = json_decode((string)file_get_contents($p), true, 512, JSON_THROW_ON_ERROR);
    $m['unexpected'] = true;
    file_put_contents($p, json_encode($m, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
}, 'MANIFEST_INVALID');

expectError('duplicate manifest path is rejected', $source, function (string $tmp): void {
    $p = $tmp . '/manifest.json';
    $m = json_decode((string)file_get_contents($p), true, 512, JSON_THROW_ON_ERROR);
    $m['files'][] = $m['files'][0];
    file_put_contents($p, json_encode($m, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
}, 'MANIFEST_DUPLICATE_PATH');

expectError('invalid manifest hash is rejected', $source, function (string $tmp): void {
    $p = $tmp . '/manifest.json';
    $m = json_decode((string)file_get_contents($p), true, 512, JSON_THROW_ON_ERROR);
    $m['files'][0]['sha256'] = 'not-a-sha256';
    file_put_contents($p, json_encode($m, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
}, 'MANIFEST_INVALID_HASH');

expectError('non-boolean required flag is rejected', $source, function (string $tmp): void {
    $p = $tmp . '/manifest.json';
    $m = json_decode((string)file_get_contents($p), true, 512, JSON_THROW_ON_ERROR);
    $m['files'][0]['required'] = 'true';
    file_put_contents($p, json_encode($m, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
}, 'MANIFEST_INVALID');

expectError('unsupported manifest file type is rejected', $source, function (string $tmp): void {
    $p = $tmp . '/manifest.json';
    $m = json_decode((string)file_get_contents($p), true, 512, JSON_THROW_ON_ERROR);
    $m['files'][0]['path'] = 'master/jobs.txt';
    file_put_contents($p, json_encode($m, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
}, 'UNSUPPORTED_FILE_TYPE');

expectError('broken document JSON is rejected', $source, function (string $tmp): void {
    rewriteRawAndManifest($tmp, 'master/jobs.json', "{broken\n");
}, 'JSON_INVALID');

expectError('invalid UTF-8 document is rejected', $source, function (string $tmp): void {
    rewriteRawAndManifest($tmp, 'master/jobs.json', "{\"x\":\"\xFF\"}");
}, 'INVALID_UTF8');

expectError('document root list is rejected', $source, function (string $tmp): void {
    rewriteRawAndManifest($tmp, 'master/jobs.json', "[]\n");
}, 'JSON_ROOT_INVALID');

expectError('missing envelope field is rejected', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'master/jobs.json', function(array &$doc):void{ unset($doc['data']); });
}, 'ENVELOPE_INVALID');

expectError('extra envelope field is rejected', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'master/jobs.json', function(array &$doc):void{ $doc['unexpected'] = true; });
}, 'ENVELOPE_INVALID');

expectError('empty metadata is rejected', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'master/jobs.json', function(array &$doc):void{ $doc['generated_by'] = ''; });
}, 'METADATA_INVALID');

expectError('invalid generated_at is rejected', $source, function (string $tmp): void {
    rewriteJsonAndManifest($tmp, 'master/jobs.json', function(array &$doc):void{ $doc['generated_at'] = 'not-a-date'; });
}, 'GENERATED_AT_INVALID');


expectLoaderError('manifest size limit stops startup',
    fn(): ExportLoader => new ExportLoader(['1.0.0'], manifestMaxBytes: 1, fileMaxBytes: 16_777_216, exportMaxBytes: 67_108_864),
    $source,
    'MANIFEST_TOO_LARGE'
);

expectLoaderError('individual JSON size limit stops startup',
    fn(): ExportLoader => new ExportLoader(['1.0.0'], manifestMaxBytes: 1_048_576, fileMaxBytes: 1, exportMaxBytes: 67_108_864),
    $source,
    'FILE_TOO_LARGE'
);

expectLoaderError('Export total size limit stops startup',
    fn(): ExportLoader => new ExportLoader(['1.0.0'], manifestMaxBytes: 4_000, fileMaxBytes: 16_777_216, exportMaxBytes: 4_000),
    $source,
    'EXPORT_TOTAL_TOO_LARGE'
);


(function (): void {
    $error = new ExportLoadException('TEST_ERROR', 'Sensitive admin detail', [
        'path' => 'master/jobs.json',
        'directory' => '/srv/private/game/Export',
        'token' => 'secret-token',
        'record' => 3,
    ]);
    $reporter = new RuntimeErrorReporter();
    $public = $reporter->publicPayload($error, 'INCIDENT-TEST');
    report('public error payload hides internal message and context',
        ($public['message'] ?? '') !== $error->getMessage()
        && !array_key_exists('context', $public)
        && ($public['incident_id'] ?? '') === 'INCIDENT-TEST'
        && ($public['error_code'] ?? '') === 'TEST_ERROR'
    );

    $admin = $reporter->adminPayload($error, 'INCIDENT-TEST');
    $context = $admin['context'] ?? [];
    report('admin error payload is structured and redacted',
        ($admin['error_code'] ?? '') === 'TEST_ERROR'
        && ($admin['incident_id'] ?? '') === 'INCIDENT-TEST'
        && ($context['path'] ?? '') === 'master/jobs.json'
        && ($context['directory'] ?? '') === '[REDACTED_PATH]'
        && ($context['token'] ?? '') === '[REDACTED]'
        && ($context['record'] ?? null) === 3
    );
})();

(function (): void {
    $tmp = sys_get_temp_dir() . '/gk-export-log-' . bin2hex(random_bytes(6)) . '/errors.jsonl';
    $error = new ExportLoadException('LOG_TEST', 'Log detail', ['path' => 'skill/skills.json']);
    $reporter = new RuntimeErrorReporter($tmp);
    $incidentId = $reporter->writeLog($error, 'INCIDENT-LOG');
    $line = is_file($tmp) ? trim((string)file_get_contents($tmp)) : '';
    $decoded = $line !== '' ? json_decode($line, true) : null;
    report('structured JSONL error log is written',
        $incidentId === 'INCIDENT-LOG'
        && is_array($decoded)
        && ($decoded['incident_id'] ?? '') === 'INCIDENT-LOG'
        && ($decoded['error_code'] ?? '') === 'LOG_TEST'
        && (($decoded['context']['path'] ?? '') === 'skill/skills.json')
    );
    if (is_file($tmp)) { unlink($tmp); }
    $dir = dirname($tmp); if (is_dir($dir)) { rmdir($dir); }
})();


(function () use ($source): void {
    $root = sys_get_temp_dir() . '/gk-atomic-update-' . bin2hex(random_bytes(6));
    $live = $root . '/Export';
    $candidate = $root . '/Candidate';
    mkdir($root, 0777, true);
    copyTree($source, $live);
    copyTree($source, $candidate);
    rewriteJsonAndManifest($candidate, 'system/game_settings.json', function(array &$doc): void {
        $doc['data'] = ['party_size' => 5];
    });
    try {
        $before = hash_file('sha256', $live . '/manifest.json');
        $package = (new AtomicExportUpdater())->update($candidate, $live);
        $after = hash_file('sha256', $live . '/manifest.json');
        $loaded = (new ExportLoader(['1.0.0']))->load($live);
        $settings = $loaded->document('system/game_settings.json')['data'] ?? [];
        $leftovers = array_values(array_filter(glob($root . '/.Export.*') ?: [], fn(string $p): bool => basename($p) !== '.Export.rollback')); 
        report('atomic update switches only validated package',
            count($package->paths()) === 22
            && $before !== $after
            && ($settings['party_size'] ?? null) === 5
            && $leftovers === []
        );
    } catch (Throwable $e) {
        report('atomic update switches only validated package', false, $e->getMessage());
    } finally {
        foreach ([$live, $candidate] as $dir) {
            if (is_dir($dir)) {
                $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
                foreach ($it as $item) { $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname()); }
                rmdir($dir);
            }
        }
        if (is_dir($root)) { $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST); foreach($it as $item){$item->isDir()?rmdir($item->getPathname()):unlink($item->getPathname());} rmdir($root); }
    }
})();

(function () use ($source): void {
    $root = sys_get_temp_dir() . '/gk-atomic-reject-' . bin2hex(random_bytes(6));
    $live = $root . '/Export';
    $candidate = $root . '/Candidate';
    mkdir($root, 0777, true);
    copyTree($source, $live);
    copyTree($source, $candidate);
    file_put_contents($candidate . '/master/jobs.json', "{}\n");
    $before = hash_file('sha256', $live . '/manifest.json');
    try {
        (new AtomicExportUpdater())->update($candidate, $live);
        report('invalid candidate leaves live Export unchanged', false, 'expected HASH_MISMATCH');
    } catch (ExportLoadException $e) {
        $after = hash_file('sha256', $live . '/manifest.json');
        $valid = false;
        try { (new ExportLoader(['1.0.0']))->load($live); $valid = true; } catch (Throwable) {}
        report('invalid candidate leaves live Export unchanged', $e->errorCode === 'HASH_MISMATCH' && $before === $after && $valid, 'received ' . $e->errorCode);
    } finally {
        foreach ([$live, $candidate] as $dir) {
            if (is_dir($dir)) {
                $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
                foreach ($it as $item) { $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname()); }
                rmdir($dir);
            }
        }
        if (is_dir($root)) { rmdir($root); }
    }
})();



(function () use ($source): void {
    $root = sys_get_temp_dir() . '/gk-rollback-' . bin2hex(random_bytes(6));
    $live = $root . '/Export'; $candidate = $root . '/Candidate';
    mkdir($root, 0777, true); copyTree($source, $live); copyTree($source, $candidate);
    rewriteJsonAndManifest($candidate, 'system/game_settings.json', function(array &$doc): void { $doc['data']=['party_size'=>6]; });
    try {
        (new AtomicExportUpdater())->update($candidate, $live);
        $backups = glob($root . '/.Export.rollback/*') ?: [];
        sort($backups);
        $backup = $backups[0] ?? '';
        $pkg = (new \GK\Export\ExportRollbackManager())->restore($backup, $live);
        $loaded=(new ExportLoader(['1.0.0']))->load($live);
        $settings=$loaded->document('system/game_settings.json')['data']??[];
        report('rollback restores validated persistent backup', count($pkg->paths())===22 && ($settings['party_size']??null)!==6 && is_dir($backup));
    } catch (Throwable $e) { report('rollback restores validated persistent backup', false, $e->getMessage()); }
    finally {
        if(is_dir($root)){ $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST); foreach($it as $item){$item->isDir()?rmdir($item->getPathname()):unlink($item->getPathname());} rmdir($root); }
    }
})();

(function () use ($source): void {
    $root = sys_get_temp_dir() . '/gk-rollback-reject-' . bin2hex(random_bytes(6));
    $live=$root.'/Export'; $bad=$root.'/Bad'; mkdir($root,0777,true); copyTree($source,$live); copyTree($source,$bad);
    file_put_contents($bad.'/master/jobs.json', "{}\n"); $before=hash_file('sha256',$live.'/manifest.json');
    try { (new \GK\Export\ExportRollbackManager())->restore($bad,$live); report('invalid rollback backup leaves live Export unchanged',false,'expected HASH_MISMATCH'); }
    catch(ExportLoadException $e){ $after=hash_file('sha256',$live.'/manifest.json'); report('invalid rollback backup leaves live Export unchanged',$e->errorCode==='HASH_MISMATCH'&&$before===$after,'received '.$e->errorCode); }
    finally { if(is_dir($root)){ $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST); foreach($it as $item){$item->isDir()?rmdir($item->getPathname()):unlink($item->getPathname());} rmdir($root);} }
})();


(function () use ($source): void {
    $tmp = sys_get_temp_dir() . '/gk-gvf-report-' . bin2hex(random_bytes(6));
    copyTree($source, $tmp);
    try {
        rewriteJsonAndManifest($tmp, 'scenario/chapters.json', function(array &$doc): void {
            $doc['data'] = [['id'=>'CH001','name'=>'孤立章']];
        });
        $pkg = (new ExportLoader(['1.0.0']))->load($tmp);
        $reportData = (new \GK\Export\GameValidationReporter())->generate($pkg, false);
        report('GVF-001 reports orphan records as warnings', ($reportData['orphan_count'] ?? 0) === 1 && (($reportData['warnings'][0]['id'] ?? null) === 'CH001'));
        try {
            (new \GK\Export\GameValidationReporter())->generate($pkg, true);
            report('GVF-001 strict mode rejects orphan records', false, 'expected ORPHAN_RECORD');
        } catch (ExportLoadException $e) {
            report('GVF-001 strict mode rejects orphan records', $e->errorCode === 'ORPHAN_RECORD', 'received ' . $e->errorCode);
        }
    } catch (Throwable $e) {
        report('GVF-001 reports orphan records as warnings', false, $e->getMessage());
        report('GVF-001 strict mode rejects orphan records', false, $e->getMessage());
    } finally {
        if (is_dir($tmp)) { $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($tmp,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST); foreach($it as $item){$item->isDir()?rmdir($item->getPathname()):unlink($item->getPathname());} rmdir($tmp); }
    }
})();


(function () use ($source): void {
    try {
        $pkg=(new ExportLoader(['1.0.0']))->load($source);
        $r=(new \GK\Export\BalanceValidator())->validate($pkg);
        report('GVF-002 official empty Export passes balance validation', $r['status']==='PASS' && $r['score']===100);
        $html=(new \GK\Export\BalanceReportRenderer())->html($r);
        report('GVF-002 renders HTML quality report', str_contains($html,'GVF-002 Balance Report') && str_contains($html,'100/100'));
    } catch (Throwable $e) {
        report('GVF-002 official empty Export passes balance validation', false, $e->getMessage());
        report('GVF-002 renders HTML quality report', false, $e->getMessage());
    }
})();

(function () use ($source): void {
    $tmp=sys_get_temp_dir().'/gk-gvf-balance-'.bin2hex(random_bytes(6)); copyTree($source,$tmp);
    try {
        rewriteJsonAndManifest($tmp,'master/jobs.json',function(array &$doc):void{$doc['data']=[['id'=>'JOB001','name'=>'異常職','str'=>101,'vit'=>13,'agi'=>7,'dex'=>9,'int'=>10,'mnd'=>12,'luk'=>8]];});
        rewriteJsonAndManifest($tmp,'system/drop_tables.json',function(array &$doc):void{$doc['data']=[['id'=>'DROP001','entries'=>[['item_id'=>'EQ001','rate'=>0.8],['item_id'=>'EQ001','rate'=>0.7]]]];});
        rewriteJsonAndManifest($tmp,'system/balance.json',function(array &$doc):void{$doc['data']=['level_exp'=>[0,100,90]];});
        $pkg=(new ExportLoader(['1.0.0']))->load($tmp); $r=(new \GK\Export\BalanceValidator())->validate($pkg);
        $codes=array_column($r['findings'],'code');
        report('GVF-002 detects range, drop and growth anomalies', $r['status']==='FAIL' && in_array('BALANCE_RANGE',$codes,true) && in_array('BALANCE_SUM',$codes,true) && in_array('BALANCE_DUPLICATE_ENTRY',$codes,true) && in_array('BALANCE_NOT_MONOTONIC',$codes,true));
    } catch(Throwable $e){report('GVF-002 detects range, drop and growth anomalies',false,$e->getMessage());}
    finally{if(is_dir($tmp)){$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($tmp,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $item){$item->isDir()?rmdir($item->getPathname()):unlink($item->getPathname());}rmdir($tmp);}}
})();


(function () use ($source): void {
    try {
        $pkg=(new ExportLoader(['1.0.0']))->load($source);
        $r=(new \GK\Export\ScenarioValidator())->validate($pkg);
        report('GVF-003 official empty Export passes scenario validation', $r['status']==='PASS' && $r['findings']===[]);
    } catch(Throwable $e) { report('GVF-003 official empty Export passes scenario validation', false, $e->getMessage()); }
})();

(function () use ($source): void {
    $tmp=sys_get_temp_dir().'/gk-gvf-scenario-'.bin2hex(random_bytes(6)); copyTree($source,$tmp);
    try {
        rewriteJsonAndManifest($tmp,'scenario/chapters.json',function(array &$doc):void{$doc['data']=[
            ['id'=>'CH001','name'=>'第一章','order'=>1],['id'=>'CH002','name'=>'第二章','order'=>2]
        ];});
        rewriteJsonAndManifest($tmp,'scenario/sections.json',function(array &$doc):void{$doc['data']=[
            ['id'=>'SEC001','chapter_id'=>'CH001','order'=>2,'boss_flag'=>false],
            ['id'=>'SEC002','chapter_id'=>'CH001','order'=>1,'boss_flag'=>true]
        ];});
        rewriteJsonAndManifest($tmp,'event/events.json',function(array &$doc):void{$doc['data']=[
            ['id'=>'EV001','order'=>1,'required_flag_ids'=>['FLAG_A']],
            ['id'=>'EV002','order'=>2,'set_flag_ids'=>['FLAG_A']]
        ];});
        $pkg=(new ExportLoader(['1.0.0']))->load($tmp);$r=(new \GK\Export\ScenarioValidator())->validate($pkg);
        $codes=array_column($r['findings'],'code');
        report('GVF-003 detects order, boss placement and flag flow anomalies',
            $r['status']==='FAIL'
            && in_array('SCENARIO_SECTION_ORDER',$codes,true)
            && in_array('SCENARIO_BOSS_NOT_TERMINAL',$codes,true)
            && in_array('SCENARIO_FLAG_REQUIRED_BEFORE_SET',$codes,true)
        );
    } catch(Throwable $e){report('GVF-003 detects order, boss placement and flag flow anomalies',false,$e->getMessage());}
    finally{if(is_dir($tmp)){$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($tmp,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $item){$item->isDir()?rmdir($item->getPathname()):unlink($item->getPathname());}rmdir($tmp);}}
})();

(function () use ($source): void {
    $tmp=sys_get_temp_dir().'/gk-gvf-milestone-'.bin2hex(random_bytes(6)); copyTree($source,$tmp);
    try {
        rewriteJsonAndManifest($tmp,'scenario/chapters.json',function(array &$doc):void{$doc['data']=[['id'=>'CH001','name'=>'第一章','order'=>1]];});
        $pkg=(new ExportLoader(['1.0.0']))->load($tmp);
        $normal=(new \GK\Export\ScenarioValidator())->validate($pkg,false);
        $strict=(new \GK\Export\ScenarioValidator())->validate($pkg,true);
        report('GVF-003 milestone policy supports warning and strict release modes', $normal['status']==='WARN' && $strict['status']==='FAIL' && $strict['summary']['critical']===4);
    } catch(Throwable $e){report('GVF-003 milestone policy supports warning and strict release modes',false,$e->getMessage());}
    finally{if(is_dir($tmp)){$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($tmp,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $item){$item->isDir()?rmdir($item->getPathname()):unlink($item->getPathname());}rmdir($tmp);}}
})();


(function (): void {
    $case=[
        'party'=>[['id'=>'P1','hp'=>120,'agi'=>20,'attack'=>22,'defense'=>4,'skill_chance'=>0.35,'skill_power'=>1.6]],
        'enemy'=>[['id'=>'E1','hp'=>120,'agi'=>18,'attack'=>20,'defense'=>4,'skill_chance'=>0.25,'skill_power'=>1.5]],
    ];
    try {
        $sim=new \GK\Export\BattleSimulator();
        $a=$sim->simulate($case,12345);$b=$sim->simulate($case,12345);$c=$sim->simulate($case,12346);
        report('GVF-004 fixed seed reproduces identical battle', $a===$b && $a['log']!==[]);
        report('GVF-004 different seed changes battle trace', $a['log']!==$c['log']);
    } catch(Throwable $e){report('GVF-004 fixed seed reproduces identical battle',false,$e->getMessage());report('GVF-004 different seed changes battle trace',false,$e->getMessage());}
})();

(function (): void {
    $case=[
        'party'=>[['id'=>'P1','hp'=>200,'agi'=>25,'attack'=>28,'defense'=>6,'skill_chance'=>0.40,'skill_power'=>1.7]],
        'enemy'=>[['id'=>'E1','hp'=>180,'agi'=>20,'attack'=>24,'defense'=>5,'skill_chance'=>0.30,'skill_power'=>1.5]],
    ];
    try {
        $r=(new \GK\Export\BattleSimulationValidator())->run($case,100,777);
        $sum=array_sum($r['wins']);
        report('GVF-004 batch aggregates wins, ticks, actions and skills', $sum===100 && $r['average_ticks']>0 && array_sum($r['actions'])>0 && isset($r['first_battle']['log']));
    } catch(Throwable $e){report('GVF-004 batch aggregates wins, ticks, actions and skills',false,$e->getMessage());}
})();

(function (): void {
    $case=[
        'party'=>[['id'=>'P1','hp'=>999999,'agi'=>1,'attack'=>1,'defense'=>999999]],
        'enemy'=>[['id'=>'E1','hp'=>999999,'agi'=>1,'attack'=>1,'defense'=>999999]],
    ];
    try {
        $r=(new \GK\Export\BattleSimulationValidator())->run($case,20,99);
        $codes=array_column($r['findings'],'code');
        report('GVF-004 detects excessive draw rate and 1000-tick exhaustion', $r['wins']['draw']===20 && in_array('SIM_DRAW_RATE_CRITICAL',$codes,true) && $r['status']==='FAIL');
    } catch(Throwable $e){report('GVF-004 detects excessive draw rate and 1000-tick exhaustion',false,$e->getMessage());}
})();



(function () use ($source): void {
    try {
        $r=(new \GK\Export\ReleaseQualityReporter())->generate($source,null,false);
        report('GVF-005 aggregates runtime through scenario checks', $r['status']==='PASS' && $r['release_ready']===true && count($r['checks'])===5 && $r['checks']['simulation']['status']==='SKIPPED');
        $html=(new \GK\Export\ReleaseQualityRenderer())->html($r);
        report('GVF-005 renders integrated HTML report', str_contains($html,'GVF-005 Release Quality Report') && str_contains($html,'Release Ready'));
        $strict=(new \GK\Export\ReleaseQualityReporter())->generate($source,null,true);
        report('GVF-005 strict release requires simulation case', $strict['status']==='FAIL' && $strict['release_ready']===false);
    } catch(Throwable $e){report('GVF-005 aggregates runtime through scenario checks',false,$e->getMessage());report('GVF-005 renders integrated HTML report',false,$e->getMessage());report('GVF-005 strict release requires simulation case',false,$e->getMessage());}
})();

(function () use ($source): void {
    $case=['party'=>[['id'=>'P1','hp'=>200,'agi'=>22,'attack'=>25,'defense'=>5]],'enemy'=>[['id'=>'E1','hp'=>200,'agi'=>22,'attack'=>25,'defense'=>5]]];
    try{$r=(new \GK\Export\ReleaseQualityReporter())->generate($source,$case,true,100,777);report('GVF-005 strict release passes with valid simulation', $r['release_ready']===true && $r['checks']['simulation']['status']!=='SKIPPED');}
    catch(Throwable $e){report('GVF-005 strict release passes with valid simulation',false,$e->getMessage());}
})();

exit($failures === 0 ? 0 : 1);
