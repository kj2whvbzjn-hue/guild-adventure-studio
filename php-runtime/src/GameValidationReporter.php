<?php
declare(strict_types=1);

namespace GK\Export;

final class GameValidationReporter
{
    /** @return array<string,mixed> */
    public function generate(ExportPackage $package, bool $strictOrphans = false): array
    {
        $base = dirname(__DIR__, 2);
        $rules = $this->readObject($base . '/schemas/data-integrity-rules.json');
        $documents = $package->allDocuments();
        $indexes = [];
        $recordCounts = [];
        foreach ($documents as $path => $document) {
            $data = $document['data'] ?? null;
            $recordCounts[$path] = is_array($data) && array_is_list($data) ? count($data) : 0;
            $indexes[$path] = [];
            if (is_array($data) && array_is_list($data)) {
                foreach ($data as $index => $record) {
                    if (is_array($record) && is_string($record['id'] ?? null)) {
                        $indexes[$path][$record['id']] = $index;
                    }
                }
            }
        }

        $incoming = [];
        $referenceChecks = 0;
        foreach (($rules['references'] ?? []) as $rule) {
            if (!is_array($rule) || !is_string($rule['source'] ?? null) || !is_string($rule['field'] ?? null)) { continue; }
            if (!is_string($rule['target'] ?? null)) { continue; }
            $target = $rule['target'];
            $incoming[$target] ??= [];
            $data = $documents[$rule['source']]['data'] ?? [];
            if (!is_array($data) || !array_is_list($data)) { continue; }
            foreach ($data as $record) {
                if (!is_array($record) || !array_key_exists($rule['field'], $record)) { continue; }
                $values = (($rule['many'] ?? false) === true) ? $record[$rule['field']] : [$record[$rule['field']]];
                if (!is_array($values)) { continue; }
                foreach ($values as $id) {
                    if (is_string($id) && $id !== '') {
                        $incoming[$target][$id] = true;
                        $referenceChecks++;
                    }
                }
            }
        }

        $orphans = [];
        foreach (($rules['orphan_checks'] ?? []) as $rule) {
            if (!is_array($rule) || !is_string($rule['target'] ?? null)) { continue; }
            $target = $rule['target'];
            foreach (($indexes[$target] ?? []) as $id => $index) {
                if (!isset($incoming[$target][$id])) {
                    $orphans[] = ['path' => $target, 'id' => $id, 'index' => $index, 'severity' => $rule['severity'] ?? 'warning'];
                }
            }
        }

        if ($strictOrphans && $orphans !== []) {
            throw new ExportLoadException('ORPHAN_RECORD', 'Orphan records were detected.', ['orphans' => $orphans]);
        }

        return [
            'framework' => 'GVF',
            'check' => 'GVF-001',
            'ok' => true,
            'schema_version' => $package->manifest['schema_version'] ?? null,
            'data_version' => $package->manifest['data_version'] ?? null,
            'file_count' => count($package->paths()),
            'record_count' => array_sum($recordCounts),
            'records_by_path' => $recordCounts,
            'reference_checks' => $referenceChecks,
            'orphan_count' => count($orphans),
            'warnings' => $orphans,
        ];
    }

    /** @return array<string,mixed> */
    private function readObject(string $path): array
    {
        $raw = file_get_contents($path);
        if ($raw === false) { throw new ExportLoadException('INTEGRITY_CONFIG_MISSING', 'Unable to read integrity rules.', ['path' => $path]); }
        try { $value = json_decode($raw, true, 512, JSON_THROW_ON_ERROR); }
        catch (\JsonException $e) { throw new ExportLoadException('INTEGRITY_CONFIG_INVALID', 'Invalid integrity rules JSON.', ['path' => $path], $e); }
        if (!is_array($value) || array_is_list($value)) { throw new ExportLoadException('INTEGRITY_CONFIG_INVALID', 'Integrity rules root must be an object.', ['path' => $path]); }
        return $value;
    }
}
