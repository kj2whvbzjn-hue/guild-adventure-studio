<?php
declare(strict_types=1);

namespace GK\Export;

use JsonException;

final class ExportLoader
{
    private ?array $schemaMap = null;
    private const MANIFEST = 'manifest.json';
    private const HASH_PATTERN = '/^[a-f0-9]{64}$/';
    private const VERSION_PATTERN = '/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?$/';
    public const DEFAULT_MANIFEST_MAX_BYTES = 1_048_576;
    public const DEFAULT_FILE_MAX_BYTES = 16_777_216;
    public const DEFAULT_EXPORT_MAX_BYTES = 67_108_864;

    /** @param list<string> $supportedSchemaVersions */
    public function __construct(
        private readonly array $supportedSchemaVersions = ['1.0.0'],
        private readonly int $manifestMaxBytes = self::DEFAULT_MANIFEST_MAX_BYTES,
        private readonly int $fileMaxBytes = self::DEFAULT_FILE_MAX_BYTES,
        private readonly int $exportMaxBytes = self::DEFAULT_EXPORT_MAX_BYTES,
    ) {
        if ($supportedSchemaVersions === []) {
            throw new ExportLoadException('CONFIG_ERROR', 'At least one supported schema_version is required.');
        }
        foreach ([
            'manifestMaxBytes' => $manifestMaxBytes,
            'fileMaxBytes' => $fileMaxBytes,
            'exportMaxBytes' => $exportMaxBytes,
        ] as $name => $value) {
            if ($value < 1) {
                throw new ExportLoadException('CONFIG_ERROR', "{$name} must be at least 1 byte.", ['setting' => $name, 'value' => $value]);
            }
        }
        if ($exportMaxBytes < $manifestMaxBytes) {
            throw new ExportLoadException('CONFIG_ERROR', 'exportMaxBytes must be greater than or equal to manifestMaxBytes.');
        }
    }

    public function load(string $exportDirectory): ExportPackage
    {
        $root = $this->normalizeRoot($exportDirectory);
        $manifestPath = $root . DIRECTORY_SEPARATOR . self::MANIFEST;
        $this->assertContainedRegularFile($root, self::MANIFEST, $manifestPath);
        $manifestBytes = $this->assertFileSize($manifestPath, self::MANIFEST, $this->manifestMaxBytes, 'MANIFEST_TOO_LARGE');
        $totalBytes = $manifestBytes;
        $manifest = $this->readJsonObject($manifestPath, 'MANIFEST');
        $this->validateManifest($manifest);

        $manifestSchema = (string)$manifest['schema_version'];
        $this->assertSupportedSchema($manifestSchema, self::MANIFEST);

        $manifestPaths = $this->validatedManifestPaths($manifest);
        $this->assertManifestMatchesExportDirectory($root, $manifestPaths);

        /** @var array<string,array<string,mixed>> $documents */
        $documents = [];
        /** @var array<string,true> $seen */
        $seen = [];

        foreach ($manifest['files'] as $index => $entry) {
            if (!is_array($entry)) {
                throw new ExportLoadException('MANIFEST_INVALID', 'Manifest file entry must be an object.', ['index' => $index]);
            }
            $path = $entry['path'] ?? null;
            $expectedHash = $entry['sha256'] ?? null;
            $required = $entry['required'] ?? null;

            if (!is_string($path) || $path === '') {
                throw new ExportLoadException('MANIFEST_INVALID', 'Manifest file path is missing or invalid.', ['index' => $index]);
            }
            $this->assertSafeRelativePath($path);
            if (isset($seen[$path])) {
                throw new ExportLoadException('MANIFEST_DUPLICATE_PATH', "Duplicate path in manifest: {$path}", ['path' => $path]);
            }
            $seen[$path] = true;

            if (!is_string($expectedHash) || preg_match(self::HASH_PATTERN, $expectedHash) !== 1) {
                throw new ExportLoadException('MANIFEST_INVALID_HASH', "Invalid SHA-256 in manifest: {$path}", ['path' => $path]);
            }
            if (!is_bool($required)) {
                throw new ExportLoadException('MANIFEST_INVALID', "Required flag must be boolean: {$path}", ['path' => $path]);
            }

            $absolute = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path);
            $this->assertNoSymlinkComponents($root, $path);
            if (!is_file($absolute)) {
                if ($required) {
                    throw new ExportLoadException('MANIFEST_MISSING_FILE', "File listed in manifest is missing: {$path}", ['path' => $path]);
                }
                continue;
            }
            if (!is_readable($absolute)) {
                throw new ExportLoadException('FILE_NOT_READABLE', "Export file is not readable: {$path}", ['path' => $path]);
            }

            $fileBytes = $this->assertFileSize($absolute, $path, $this->fileMaxBytes, 'FILE_TOO_LARGE');
            $totalBytes += $fileBytes;
            if ($totalBytes > $this->exportMaxBytes) {
                throw new ExportLoadException('EXPORT_TOTAL_TOO_LARGE', 'Export package exceeds the configured total size limit.', [
                    'path' => $path,
                    'actual_bytes' => $totalBytes,
                    'max_bytes' => $this->exportMaxBytes,
                ]);
            }

            $actualHash = hash_file('sha256', $absolute);
            if (!is_string($actualHash) || !hash_equals($expectedHash, $actualHash)) {
                throw new ExportLoadException('HASH_MISMATCH', "SHA-256 mismatch: {$path}", [
                    'path' => $path,
                    'expected' => $expectedHash,
                    'actual' => $actualHash,
                ]);
            }

            $document = $this->readJsonObject($absolute, $path);
            $this->validateEnvelope($document, $path);
            $this->assertMetadataMatchesManifest($manifest, $document, $path);
            $this->assertSupportedSchema((string)$document['schema_version'], $path);
            $this->validateDataSchema($document['data'], $path);
            $documents[$path] = $document;
        }

        (new DataIntegrityValidator())->validate($manifest, $documents);

        return new ExportPackage($manifest, $documents);
    }


    /**
     * @param array<string,mixed> $manifest
     * @param array<string,mixed> $document
     */
    private function assertMetadataMatchesManifest(array $manifest, array $document, string $path): void
    {
        $checks = [
            'schema_version' => 'SCHEMA_VERSION_MISMATCH',
            'data_version' => 'DATA_VERSION_MISMATCH',
            'generated_at' => 'GENERATED_AT_MISMATCH',
            'generated_by' => 'GENERATED_BY_MISMATCH',
        ];

        foreach ($checks as $field => $errorCode) {
            $manifestValue = (string)$manifest[$field];
            $documentValue = (string)$document[$field];
            if ($documentValue !== $manifestValue) {
                throw new ExportLoadException($errorCode, "{$field} differs from manifest: {$path}", [
                    'path' => $path,
                    'field' => $field,
                    'manifest_value' => $manifestValue,
                    'document_value' => $documentValue,
                ]);
            }
        }
    }

    private function validateDataSchema(mixed $data, string $path): void
    {
        $base = dirname(__DIR__, 2);
        if ($this->schemaMap === null) {
            $mapPath = $base . '/schemas/export-schema-map.json';
            $this->schemaMap = $this->readJsonObject($mapPath, 'SCHEMA_MAP');
        }
        $schemaRel = $this->schemaMap[$path] ?? null;
        if (!is_string($schemaRel) || $schemaRel === '') {
            throw new ExportLoadException('DATA_SCHEMA_MISSING', "No schema assigned: {$path}", ['path'=>$path]);
        }
        $schema = $this->readJsonObject($base . '/' . $schemaRel, 'SCHEMA ' . $path);
        try { (new SimpleSchemaValidator())->validate($data, $schema, '$.data'); }
        catch (ExportLoadException $e) { throw new ExportLoadException($e->errorCode, $e->getMessage(), ['path'=>$path] + $e->context, $e); }
    }

    /**
     * @param array<string,mixed> $manifest
     * @return list<string>
     */
    private function validatedManifestPaths(array $manifest): array
    {
        $paths = [];
        $seen = [];
        foreach ($manifest['files'] as $index => $entry) {
            if (!is_array($entry)) {
                throw new ExportLoadException('MANIFEST_INVALID', 'Manifest file entry must be an object.', ['index' => $index]);
            }
            $path = $entry['path'] ?? null;
            if (!is_string($path) || $path === '') {
                throw new ExportLoadException('MANIFEST_INVALID', 'Manifest file path is missing or invalid.', ['index' => $index]);
            }
            $this->assertSafeRelativePath($path);
            if (isset($seen[$path])) {
                throw new ExportLoadException('MANIFEST_DUPLICATE_PATH', "Duplicate path in manifest: {$path}", ['path' => $path]);
            }
            $seen[$path] = true;
            $paths[] = $path;
        }
        sort($paths);
        return $paths;
    }

    /** @param list<string> $manifestPaths */
    private function assertManifestMatchesExportDirectory(string $root, array $manifestPaths): void
    {
        $expected = array_fill_keys($manifestPaths, true);
        $actual = [];
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $item) {
            $absolute = $item->getPathname();
            $relative = str_replace(DIRECTORY_SEPARATOR, '/', substr($absolute, strlen($root) + 1));
            if ($item->isLink()) {
                throw new ExportLoadException('SYMLINK_FORBIDDEN', "Symbolic links are forbidden in Export: {$relative}", ['path' => $relative]);
            }
            if ($item->isDir()) {
                continue;
            }
            if (!$item->isFile()) {
                throw new ExportLoadException('UNSUPPORTED_FILE_TYPE', "Unsupported filesystem entry in Export: {$relative}", ['path' => $relative]);
            }
            if ($relative === self::MANIFEST) {
                continue;
            }
            $actual[$relative] = true;
        }

        $unknown = array_values(array_diff(array_keys($actual), array_keys($expected)));
        sort($unknown);
        if ($unknown !== []) {
            throw new ExportLoadException('MANIFEST_UNKNOWN_FILE', 'Export contains file not registered in manifest.', [
                'path' => $unknown[0],
                'unknown_files' => $unknown,
            ]);
        }

        $missing = array_values(array_diff(array_keys($expected), array_keys($actual)));
        sort($missing);
        if ($missing !== []) {
            throw new ExportLoadException('MANIFEST_MISSING_FILE', 'Manifest lists a file that is missing from Export.', [
                'path' => $missing[0],
                'missing_files' => $missing,
            ]);
        }
    }

    private function normalizeRoot(string $directory): string
    {
        if ($directory === '') {
            throw new ExportLoadException('EXPORT_DIRECTORY_INVALID', 'Export directory is empty.');
        }
        if (is_link($directory)) {
            throw new ExportLoadException('SYMLINK_FORBIDDEN', 'The Export directory itself must not be a symbolic link.', ['directory' => $directory]);
        }
        $real = realpath($directory);
        if ($real === false || !is_dir($real)) {
            throw new ExportLoadException('EXPORT_DIRECTORY_NOT_FOUND', "Export directory was not found: {$directory}", ['directory' => $directory]);
        }
        if (!is_readable($real)) {
            throw new ExportLoadException('EXPORT_DIRECTORY_NOT_READABLE', "Export directory is not readable: {$directory}", ['directory' => $directory]);
        }
        return $real;
    }


    private function assertContainedRegularFile(string $root, string $relativePath, string $absolutePath): void
    {
        $this->assertNoSymlinkComponents($root, $relativePath);
        if (!is_file($absolutePath)) {
            throw new ExportLoadException('MANIFEST_MISSING', "Required file is missing: {$relativePath}", ['path' => $relativePath]);
        }
        $real = realpath($absolutePath);
        if ($real === false || !$this->isPathInsideRoot($root, $real)) {
            throw new ExportLoadException('PATH_OUTSIDE_EXPORT', "Export file resolves outside the Export directory: {$relativePath}", [
                'path' => $relativePath,
            ]);
        }
    }

    private function assertNoSymlinkComponents(string $root, string $relativePath): void
    {
        $segments = preg_split('#[\\/]#', $relativePath) ?: [];
        $current = $root;
        foreach ($segments as $segment) {
            if ($segment === '') {
                continue;
            }
            $current .= DIRECTORY_SEPARATOR . $segment;
            if (is_link($current)) {
                throw new ExportLoadException('SYMLINK_FORBIDDEN', "Symbolic links are forbidden in Export: {$relativePath}", [
                    'path' => $relativePath,
                    'component' => $segment,
                ]);
            }
            if (!file_exists($current) && !is_link($current)) {
                break;
            }
        }

        if (file_exists($current)) {
            $real = realpath($current);
            if ($real !== false && !$this->isPathInsideRoot($root, $real)) {
                throw new ExportLoadException('PATH_OUTSIDE_EXPORT', "Export path resolves outside the Export directory: {$relativePath}", [
                    'path' => $relativePath,
                ]);
            }
        }
    }

    private function isPathInsideRoot(string $root, string $path): bool
    {
        $normalizedRoot = rtrim(str_replace('\\', '/', $root), '/');
        $normalizedPath = str_replace('\\', '/', $path);
        return $normalizedPath === $normalizedRoot || str_starts_with($normalizedPath, $normalizedRoot . '/');
    }

    private function assertFileSize(string $absolutePath, string $label, int $maxBytes, string $errorCode): int
    {
        if (!is_file($absolutePath)) {
            throw new ExportLoadException('MANIFEST_MISSING', "Required file is missing: {$label}", ['path' => $absolutePath]);
        }
        $bytes = filesize($absolutePath);
        if ($bytes === false) {
            throw new ExportLoadException('FILE_SIZE_READ_FAILED', "Failed to read file size: {$label}", ['path' => $absolutePath]);
        }
        if ($bytes > $maxBytes) {
            throw new ExportLoadException($errorCode, "File exceeds the configured size limit: {$label}", [
                'path' => $label,
                'actual_bytes' => $bytes,
                'max_bytes' => $maxBytes,
            ]);
        }
        return $bytes;
    }

    /** @return array<string,mixed> */
    private function readJsonObject(string $path, string $label): array
    {
        if (!is_file($path)) {
            throw new ExportLoadException('MANIFEST_MISSING', "Required file is missing: {$label}", ['path' => $path]);
        }
        $raw = file_get_contents($path);
        if ($raw === false) {
            throw new ExportLoadException('FILE_READ_FAILED', "Failed to read JSON: {$label}", ['path' => $path]);
        }
        if (preg_match('//u', $raw) !== 1) {
            throw new ExportLoadException('INVALID_UTF8', "JSON is not valid UTF-8: {$label}", ['path' => $path]);
        }
        try {
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new ExportLoadException('JSON_INVALID', "Invalid JSON: {$label}", ['path' => $path, 'json_error' => $e->getMessage()], $e);
        }
        if (!is_array($decoded) || array_is_list($decoded)) {
            throw new ExportLoadException('JSON_ROOT_INVALID', "JSON root must be an object: {$label}", ['path' => $path]);
        }
        return $decoded;
    }

    /** @param array<string,mixed> $manifest */
    private function validateManifest(array $manifest): void
    {
        foreach (['schema_version', 'data_version', 'generated_at', 'generated_by', 'files'] as $key) {
            if (!array_key_exists($key, $manifest)) {
                throw new ExportLoadException('MANIFEST_INVALID', "Manifest field is missing: {$key}", ['field' => $key]);
            }
        }
        $allowed = ['schema_version', 'data_version', 'generated_at', 'generated_by', 'files'];
        $extra = array_values(array_diff(array_keys($manifest), $allowed));
        if ($extra !== []) {
            throw new ExportLoadException('MANIFEST_INVALID', 'Manifest contains unsupported fields.', ['fields' => $extra]);
        }
        $this->validateCommonMetadata($manifest, self::MANIFEST);
        if (!is_array($manifest['files']) || !array_is_list($manifest['files']) || $manifest['files'] === []) {
            throw new ExportLoadException('MANIFEST_INVALID', 'Manifest files must be a non-empty list.');
        }
    }

    /** @param array<string,mixed> $document */
    private function validateEnvelope(array $document, string $path): void
    {
        $required = ['schema_version', 'data_version', 'generated_at', 'generated_by', 'data'];
        foreach ($required as $key) {
            if (!array_key_exists($key, $document)) {
                throw new ExportLoadException('ENVELOPE_INVALID', "Required envelope field is missing: {$path} / {$key}", ['path' => $path, 'field' => $key]);
            }
        }
        $extra = array_values(array_diff(array_keys($document), $required));
        if ($extra !== []) {
            throw new ExportLoadException('ENVELOPE_INVALID', "Envelope contains unsupported fields: {$path}", ['path' => $path, 'fields' => $extra]);
        }
        $this->validateCommonMetadata($document, $path);
    }

    /** @param array<string,mixed> $object */
    private function validateCommonMetadata(array $object, string $path): void
    {
        foreach (['schema_version', 'data_version', 'generated_at', 'generated_by'] as $field) {
            if (!is_string($object[$field]) || $object[$field] === '') {
                throw new ExportLoadException('METADATA_INVALID', "Metadata must be a non-empty string: {$path} / {$field}", ['path' => $path, 'field' => $field]);
            }
        }
        if (preg_match(self::VERSION_PATTERN, (string)$object['schema_version']) !== 1) {
            throw new ExportLoadException('SCHEMA_VERSION_INVALID', "Invalid schema_version: {$path}", ['path' => $path]);
        }
        if (strtotime((string)$object['generated_at']) === false) {
            throw new ExportLoadException('GENERATED_AT_INVALID', "Invalid generated_at date-time: {$path}", ['path' => $path]);
        }
    }

    private function assertSupportedSchema(string $version, string $path): void
    {
        if (!in_array($version, $this->supportedSchemaVersions, true)) {
            throw new ExportLoadException('SCHEMA_VERSION_UNSUPPORTED', "Unsupported schema_version {$version}: {$path}", [
                'path' => $path,
                'schema_version' => $version,
                'supported' => $this->supportedSchemaVersions,
            ]);
        }
    }

    private function assertSafeRelativePath(string $path): void
    {
        if (str_contains($path, "\0") || str_starts_with($path, '/') || str_starts_with($path, '\\')) {
            throw new ExportLoadException('UNSAFE_PATH', "Unsafe Export path: {$path}", ['path' => $path]);
        }
        if (preg_match('/^[A-Za-z]:[\\\\\/]/', $path) === 1) {
            throw new ExportLoadException('UNSAFE_PATH', "Absolute Export path is forbidden: {$path}", ['path' => $path]);
        }
        $segments = preg_split('#[\\\\/]#', $path) ?: [];
        if (in_array('..', $segments, true) || in_array('.', $segments, true)) {
            throw new ExportLoadException('UNSAFE_PATH', "Path traversal is forbidden: {$path}", ['path' => $path]);
        }
        if (!str_ends_with(strtolower($path), '.json')) {
            throw new ExportLoadException('UNSUPPORTED_FILE_TYPE', "Only JSON files are allowed: {$path}", ['path' => $path]);
        }
    }
}
