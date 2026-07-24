<?php
declare(strict_types=1);

namespace GK\Export;

final class DataIntegrityValidator
{
    /** @param array<string,array<string,mixed>> $documents */
    public function validate(array $manifest, array $documents): void
    {
        $base = dirname(__DIR__, 2);
        $schemaMap = $this->readObject($base . '/schemas/export-schema-map.json', 'schema map');
        $rules = $this->readObject($base . '/schemas/data-integrity-rules.json', 'integrity rules');

        $this->validateOfficialPaths($manifest, $documents, array_keys($schemaMap));
        $indexes = $this->buildIndexes($documents);
        $groups = $this->validateDuplicates($documents, $indexes, $rules['duplicate_groups'] ?? []);
        $this->validateReferences($documents, $indexes, $groups, $rules['references'] ?? []);
    }

    /** @param list<string> $official */
    private function validateOfficialPaths(array $manifest, array $documents, array $official): void
    {
        sort($official);
        $manifestPaths = [];
        foreach (($manifest['files'] ?? []) as $entry) {
            if (!is_array($entry) || !is_string($entry['path'] ?? null)) {
                continue; // ExportLoaderのmanifest検証が先に処理する。
            }
            if (($entry['required'] ?? null) !== true) {
                throw new ExportLoadException('OFFICIAL_PATH_NOT_REQUIRED', 'Official Export path must be required.', ['path' => $entry['path']]);
            }
            $manifestPaths[] = $entry['path'];
        }
        sort($manifestPaths);
        $loadedPaths = array_keys($documents);
        sort($loadedPaths);

        $missing = array_values(array_diff($official, $manifestPaths));
        $extra = array_values(array_diff($manifestPaths, $official));
        if ($missing !== [] || $extra !== []) {
            throw new ExportLoadException('OFFICIAL_PATH_SET_MISMATCH', 'Manifest must contain the exact official 22 Export paths.', [
                'missing' => $missing,
                'extra' => $extra,
                'expected_count' => count($official),
                'actual_count' => count($manifestPaths),
            ]);
        }
        if ($loadedPaths !== $official) {
            throw new ExportLoadException('OFFICIAL_PATH_LOAD_MISMATCH', 'Loaded documents do not match the official path set.', [
                'missing' => array_values(array_diff($official, $loadedPaths)),
                'extra' => array_values(array_diff($loadedPaths, $official)),
            ]);
        }
    }

    /** @return array<string,array<string,array{index:int,record:array<string,mixed>}>> */
    private function buildIndexes(array $documents): array
    {
        $indexes = [];
        foreach ($documents as $path => $document) {
            $data = $document['data'] ?? null;
            if (!is_array($data) || !array_is_list($data)) {
                continue;
            }
            $indexes[$path] = [];
            foreach ($data as $index => $record) {
                if (!is_array($record) || !is_string($record['id'] ?? null)) {
                    continue; // 個別Schemaが先に拒否する。
                }
                $id = $record['id'];
                if (isset($indexes[$path][$id])) {
                    throw new ExportLoadException('DUPLICATE_ID', "Duplicate ID {$id} in {$path}.", [
                        'path' => $path,
                        'id' => $id,
                        'first_index' => $indexes[$path][$id]['index'],
                        'duplicate_index' => $index,
                    ]);
                }
                $indexes[$path][$id] = ['index' => $index, 'record' => $record];
            }
        }
        return $indexes;
    }

    /** @return array<string,array<string,array{path:string,index:int}>> */
    private function validateDuplicates(array $documents, array $indexes, mixed $groupRules): array
    {
        $groups = [];
        if (!is_array($groupRules)) {
            return $groups;
        }
        foreach ($groupRules as $rule) {
            if (!is_array($rule) || !is_string($rule['name'] ?? null) || !is_array($rule['paths'] ?? null)) {
                throw new ExportLoadException('INTEGRITY_RULE_INVALID', 'Invalid duplicate group rule.');
            }
            $name = $rule['name'];
            $groups[$name] = [];
            foreach ($rule['paths'] as $path) {
                if (!is_string($path)) {
                    throw new ExportLoadException('INTEGRITY_RULE_INVALID', 'Duplicate group path must be a string.', ['group' => $name]);
                }
                foreach (($indexes[$path] ?? []) as $id => $entry) {
                    if (isset($groups[$name][$id])) {
                        throw new ExportLoadException('DUPLICATE_ID_GROUP', "Duplicate ID {$id} in integrity group {$name}.", [
                            'group' => $name,
                            'id' => $id,
                            'first_path' => $groups[$name][$id]['path'],
                            'first_index' => $groups[$name][$id]['index'],
                            'duplicate_path' => $path,
                            'duplicate_index' => $entry['index'],
                        ]);
                    }
                    $groups[$name][$id] = ['path' => $path, 'index' => $entry['index']];
                }
            }
        }
        return $groups;
    }

    private function validateReferences(array $documents, array $indexes, array $groups, mixed $referenceRules): void
    {
        if (!is_array($referenceRules)) {
            return;
        }
        foreach ($referenceRules as $rule) {
            if (!is_array($rule) || !is_string($rule['source'] ?? null) || !is_string($rule['field'] ?? null)) {
                throw new ExportLoadException('INTEGRITY_RULE_INVALID', 'Invalid reference rule.');
            }
            $source = $rule['source'];
            $field = $rule['field'];
            $many = ($rule['many'] ?? false) === true;
            $targetIndex = null;
            $targetLabel = '';
            if (is_string($rule['target'] ?? null)) {
                $targetLabel = $rule['target'];
                $targetIndex = $indexes[$targetLabel] ?? [];
            } elseif (is_string($rule['target_group'] ?? null)) {
                $targetLabel = 'group:' . $rule['target_group'];
                $targetIndex = $groups[$rule['target_group']] ?? [];
            } else {
                throw new ExportLoadException('INTEGRITY_RULE_INVALID', 'Reference rule requires target or target_group.', ['source' => $source, 'field' => $field]);
            }

            $data = $documents[$source]['data'] ?? [];
            if (!is_array($data) || !array_is_list($data)) {
                continue;
            }
            foreach ($data as $index => $record) {
                if (!is_array($record) || !array_key_exists($field, $record) || $record[$field] === null || $record[$field] === '') {
                    continue;
                }
                $values = $many ? $record[$field] : [$record[$field]];
                if (!is_array($values)) {
                    throw new ExportLoadException('REFERENCE_VALUE_INVALID', "Reference field must be an array: {$source}[{$index}].{$field}", ['path' => $source, 'index' => $index, 'field' => $field]);
                }
                foreach ($values as $valueIndex => $id) {
                    if (!is_string($id) || $id === '') {
                        throw new ExportLoadException('REFERENCE_VALUE_INVALID', 'Reference ID must be a non-empty string.', ['path' => $source, 'index' => $index, 'field' => $field, 'value_index' => $valueIndex]);
                    }
                    if (!isset($targetIndex[$id])) {
                        throw new ExportLoadException('REFERENCE_NOT_FOUND', "Reference {$id} was not found for {$source}[{$index}].{$field}.", [
                            'path' => $source,
                            'index' => $index,
                            'record_id' => is_string($record['id'] ?? null) ? $record['id'] : null,
                            'field' => $field,
                            'reference_id' => $id,
                            'target' => $targetLabel,
                        ]);
                    }
                }
            }
        }
    }

    /** @return array<string,mixed> */
    private function readObject(string $path, string $label): array
    {
        $raw = file_get_contents($path);
        if ($raw === false) {
            throw new ExportLoadException('INTEGRITY_CONFIG_MISSING', "Unable to read {$label}.", ['path' => $path]);
        }
        try {
            $value = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            throw new ExportLoadException('INTEGRITY_CONFIG_INVALID', "Invalid JSON in {$label}.", ['path' => $path], $e);
        }
        if (!is_array($value) || array_is_list($value)) {
            throw new ExportLoadException('INTEGRITY_CONFIG_INVALID', "{$label} root must be an object.", ['path' => $path]);
        }
        return $value;
    }
}
