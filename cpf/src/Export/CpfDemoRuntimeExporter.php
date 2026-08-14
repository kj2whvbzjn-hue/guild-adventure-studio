<?php
declare(strict_types=1);
namespace GK\CPF\Export;

use GK\CPF\Core\{CpfException, CpfNodeManager};

final class CpfDemoRuntimeExporter
{
    private const ACCEPTED = ['APPROVED', 'LOCKED'];
    private const MAP = [
        'chapter' => 'scenario/chapters.json',
        'section' => 'scenario/sections.json',
        'scene' => 'scenario/scenes.json',
        'event' => 'event/events.json',
    ];

    public function __construct(private CpfNodeManager $nodes = new CpfNodeManager()) {}

    public function export(string $projectDir, string $baseExportDir, string $outputDir, string $dataVersion = '0.1.0-demo'): array
    {
        if (!is_dir($baseExportDir) || !is_file($baseExportDir . '/manifest.json')) {
            throw new CpfException('BASE_EXPORT_INVALID', 'Base Export directory or manifest.json was not found.');
        }
        if ($outputDir === '' || realpath($baseExportDir) === realpath($outputDir)) {
            throw new CpfException('OUTPUT_EXPORT_INVALID', 'Output directory must differ from base Export directory.');
        }

        $all = $this->nodes->all($projectDir);
        $approved = [];
        foreach ($all as $node) {
            $type = (string)($node['node_type'] ?? '');
            if (!isset(self::MAP[$type]) || !in_array((string)($node['status'] ?? ''), self::ACCEPTED, true)) continue;
            $approved[$type][] = $this->toRuntimeRecord($node);
        }
        foreach (array_keys(self::MAP) as $type) {
            if (($approved[$type] ?? []) === []) {
                throw new CpfException('DEMO_EXPORT_REQUIRED_NODE_MISSING', "Approved {$type} node is required.", 2);
            }
        }

        $tmp = $outputDir . '.tmp.' . bin2hex(random_bytes(4));
        $backup = $outputDir . '.bak.' . bin2hex(random_bytes(4));
        try {
            $this->copyTree($baseExportDir, $tmp);
            $generatedAt = date(DATE_ATOM);
            $generatedBy = 'GK Studio CPF Demo Runtime Exporter';

            $manifestPath = $tmp . '/manifest.json';
            $manifest = $this->readJson($manifestPath);
            if (!is_array($manifest['files'] ?? null)) {
                throw new CpfException('BASE_EXPORT_INVALID', 'Base Export manifest files list is invalid.');
            }

            // Rewrite only the official Runtime Export documents listed by the
            // manifest. Export/cpf is an auxiliary tool payload, not Runtime data.
            // Formal Skill v2 is independently versioned and must not be
            // downgraded to the legacy package envelope by a CPF story export.
            foreach ($manifest['files'] as $entry) {
                $relative = is_array($entry) ? ($entry['path'] ?? null) : null;
                if (!is_string($relative) || $relative === '') {
                    throw new CpfException('BASE_EXPORT_INVALID', 'Base Export manifest contains an invalid path.');
                }
                $path = $tmp . '/' . $relative;
                if (!is_file($path)) throw new CpfException('BASE_EXPORT_FILE_MISSING', 'Manifest file missing: ' . $relative);
                $doc = $this->readJson($path);
                $isFormalSkillV2 = $relative === 'skill/skills.json' && ($doc['schema_version'] ?? null) === '2.0.0';
                if (!$isFormalSkillV2) {
                    $doc['schema_version'] = '1.0.0';
                    $doc['data_version'] = $dataVersion;
                    $doc['generated_at'] = $generatedAt;
                    $doc['generated_by'] = $generatedBy;
                }
                foreach (self::MAP as $type => $mapped) {
                    if ($relative === $mapped) $doc['data'] = $approved[$type];
                }
                $this->writeJson($path, $doc);
            }

            $manifest['schema_version'] = '1.0.0';
            $manifest['data_version'] = $dataVersion;
            $manifest['generated_at'] = $generatedAt;
            $manifest['generated_by'] = $generatedBy;
            foreach ($manifest['files'] as &$entry) {
                $file = $tmp . '/' . $entry['path'];
                if (!is_file($file)) throw new CpfException('BASE_EXPORT_FILE_MISSING', 'Manifest file missing: ' . $entry['path']);
                $entry['sha256'] = hash_file('sha256', $file);
            }
            unset($entry);
            $this->writeJson($manifestPath, $manifest);

            if (is_dir($outputDir)) rename($outputDir, $backup);
            if (!rename($tmp, $outputDir)) throw new CpfException('EXPORT_COMMIT_FAILED', 'Could not commit generated Export.');
            if (is_dir($backup)) $this->removeTree($backup);

            return [
                'ok' => true,
                'output_dir' => $outputDir,
                'data_version' => $dataVersion,
                'generated_at' => $generatedAt,
                'exported_counts' => array_map('count', $approved),
                'manifest_sha256' => hash_file('sha256', $outputDir . '/manifest.json'),
                'next_action' => 'php-runtime/bin/validate-export.php で生成物を検証してください。',
            ];
        } catch (\Throwable $e) {
            if (is_dir($tmp)) $this->removeTree($tmp);
            if (is_dir($backup) && !is_dir($outputDir)) rename($backup, $outputDir);
            throw $e;
        }
    }

    private function toRuntimeRecord(array $node): array
    {
        $payload = is_array($node['payload'] ?? null) ? $node['payload'] : [];
        return array_merge($payload, [
            'id' => (string)$node['node_id'],
            'name' => (string)($payload['name'] ?? $payload['title'] ?? $node['node_id']),
            'cpf_status' => (string)$node['status'],
            'cpf_version' => (int)$node['version'],
        ]);
    }

    private function jsonFiles(string $root): array
    {
        $out = [];
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS));
        foreach ($it as $item) if ($item->isFile() && $item->getFilename() !== 'manifest.json' && strtolower($item->getExtension()) === 'json') $out[] = $item->getPathname();
        sort($out); return $out;
    }

    private function copyTree(string $src, string $dst): void
    {
        mkdir($dst, 0777, true);
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($src, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::SELF_FIRST);
        foreach ($it as $item) {
            if ($item->isLink()) throw new CpfException('SYMLINK_FORBIDDEN', 'Symlinks are forbidden in Export.');
            $target = $dst . '/' . str_replace('\\', '/', $it->getSubPathName());
            $item->isDir() ? @mkdir($target, 0777, true) : copy($item->getPathname(), $target);
        }
    }
    private function readJson(string $path): array { $v=json_decode((string)file_get_contents($path),true); if(!is_array($v)) throw new CpfException('JSON_INVALID','Invalid JSON: '.$path); return $v; }
    private function writeJson(string $path,array $v): void { if(file_put_contents($path,json_encode($v,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)."\n",LOCK_EX)===false) throw new CpfException('WRITE_FAILED','Cannot write: '.$path); }
    private function removeTree(string $dir): void { if(!is_dir($dir))return; foreach(array_diff(scandir($dir)?:[],['.','..']) as $i){$p="$dir/$i";is_dir($p)&&!is_link($p)?$this->removeTree($p):@unlink($p);}@rmdir($dir); }
}
