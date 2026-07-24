<?php
declare(strict_types=1);

namespace GK\Export;

/** Immutable ID-indexed view over one Export data array. */
final class RecordCollection
{
    /** @var list<array<string,mixed>> */
    private array $records;
    /** @var array<string,array<string,mixed>> */
    private array $byId = [];

    /** @param mixed $data */
    public function __construct(public readonly string $path, mixed $data)
    {
        if (!is_array($data) || !array_is_list($data)) {
            throw new ExportLoadException('REPOSITORY_DATA_INVALID', "Repository data must be a list: {$path}", ['path' => $path]);
        }
        $this->records = [];
        foreach ($data as $index => $record) {
            if (!is_array($record)) {
                throw new ExportLoadException('REPOSITORY_RECORD_INVALID', "Repository record must be an object: {$path}", ['path' => $path, 'record' => $index]);
            }
            $id = $record['id'] ?? null;
            if (!is_string($id) || $id === '') {
                throw new ExportLoadException('REPOSITORY_ID_INVALID', "Repository record id is invalid: {$path}", ['path' => $path, 'record' => $index]);
            }
            if (isset($this->byId[$id])) {
                throw new ExportLoadException('REPOSITORY_DUPLICATE_ID', "Duplicate repository id: {$id}", ['path' => $path, 'id' => $id]);
            }
            $this->records[] = $record;
            $this->byId[$id] = $record;
        }
    }

    /** @return list<array<string,mixed>> */
    public function all(): array { return $this->records; }
    public function count(): int { return count($this->records); }
    public function has(string $id): bool { return isset($this->byId[$id]); }

    /** @return array<string,mixed>|null */
    public function find(string $id): ?array { return $this->byId[$id] ?? null; }

    /** @return array<string,mixed> */
    public function require(string $id): array
    {
        $record = $this->find($id);
        if ($record === null) {
            throw new ExportLoadException('RECORD_NOT_FOUND', "Master record was not found: {$id}", ['path' => $this->path, 'id' => $id]);
        }
        return $record;
    }
}
