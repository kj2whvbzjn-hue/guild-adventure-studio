<?php
declare(strict_types=1);
namespace GK\CPF\History;

use GK\CPF\Core\JsonStore;

final class CpfHistoryRepository
{
    public function __construct(private JsonStore $store = new JsonStore()) {}

    public function add(
        string $projectDir,
        string $nodeId,
        string $operation,
        int $fromVersion,
        int $toVersion,
        array $changedFields = [],
        string $changeReason = '',
        array $metadata = []
    ): array {
        $path = $projectDir . '/history/history.json';
        $history = $this->store->read($path, []);
        $record = [
            'history_id' => sprintf('HIST_%06d', count($history) + 1),
            'node_id' => $nodeId,
            'operation' => $operation,
            'from_version' => $fromVersion,
            'to_version' => $toVersion,
            'changed_fields' => array_values($changedFields),
            'change_reason' => $changeReason,
            'metadata' => $metadata,
            'created_at' => date(DATE_ATOM),
        ];
        $history[] = $record;
        $this->store->write($path, $history);
        return $record;
    }

    public function all(string $projectDir): array
    {
        return $this->store->read($projectDir . '/history/history.json', []);
    }
}
