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
            'history_id' => sprintf('HIST_%06d', $this->nextNumber($history)),
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

    private function nextNumber(array $history): int
    {
        $max = 0;
        foreach ($history as $record) {
            if (preg_match('/^HIST_(\d+)$/', (string)($record['history_id'] ?? ''), $match)) {
                $max = max($max, (int)$match[1]);
            }
        }
        return $max + 1;
    }

    public function all(string $projectDir): array
    {
        return $this->store->read($projectDir . '/history/history.json', []);
    }
}
