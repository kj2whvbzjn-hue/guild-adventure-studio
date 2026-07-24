<?php
declare(strict_types=1);
namespace GK\CPF\Revision;

use GK\CPF\Core\{CpfException, CpfNodeManager, JsonStore};
use GK\CPF\History\CpfHistoryRepository;

final class CpfRevisionRepository
{
    public function __construct(
        private JsonStore $store = new JsonStore(),
        private CpfNodeManager $nodes = new CpfNodeManager(),
        private CpfHistoryRepository $history = new CpfHistoryRepository()
    ) {}

    public function createCandidate(string $projectDir, string $nodeId, array $patch, string $reason = ''): array
    {
        $base = $this->nodes->get($projectDir, $nodeId);
        if (($base['locked'] ?? false) === true) {
            throw new CpfException('NODE_LOCKED', 'Locked node', 3);
        }

        $candidate = array_replace_recursive($base, $patch);
        foreach (($base['manual_fields'] ?? []) as $field) {
            if (array_key_exists($field, $base['payload'] ?? [])) {
                $candidate['payload'][$field] = $base['payload'][$field];
            }
        }

        $items = $this->list($projectDir, $nodeId);
        $number = count($items) + 1;
        $revisionId = sprintf('REV_%s_%06d', preg_replace('/[^A-Za-z0-9_-]/', '_', $nodeId), $number);
        $now = date(DATE_ATOM);
        $candidate['revision_id'] = $revisionId;
        $candidate['base_version'] = $base['version'];
        $candidate['candidate_version'] = $base['version'] + 1;
        $candidate['status'] = 'REVIEW';
        $candidate['revision_status'] = 'CANDIDATE';
        $candidate['change_reason'] = $reason;
        $candidate['created_at'] = $now;
        $candidate['updated_at'] = $now;

        $this->store->write($this->path($projectDir, $nodeId, $revisionId), $candidate);
        $this->history->add($projectDir, $nodeId, 'CREATE_REVISION', $base['version'], $base['version'], $this->changed($base, $candidate), $reason, ['revision_id' => $revisionId]);
        return $candidate;
    }

    public function get(string $projectDir, string $nodeId, string $revisionId): array
    {
        $revision = $this->store->read($this->path($projectDir, $nodeId, $revisionId), null);
        if (!is_array($revision)) {
            throw new CpfException('REVISION_NOT_FOUND', "Revision not found: $revisionId");
        }
        return $revision;
    }

    public function list(string $projectDir, string $nodeId): array
    {
        $out = [];
        foreach (glob($projectDir . '/revisions/' . $nodeId . '/*.json') ?: [] as $path) {
            $item = $this->store->read($path, null);
            if (is_array($item)) {
                $out[] = $item;
            }
        }
        usort($out, static fn(array $a, array $b): int => strcmp((string)$a['revision_id'], (string)$b['revision_id']));
        return $out;
    }

    public function approveAndPromote(string $projectDir, string $nodeId, string $revisionId, string $approvedBy = 'user'): array
    {
        $current = $this->nodes->get($projectDir, $nodeId);
        $revision = $this->get($projectDir, $nodeId, $revisionId);
        if (($revision['revision_status'] ?? '') !== 'CANDIDATE') {
            throw new CpfException('REVISION_NOT_CANDIDATE', 'Only candidate revisions can be promoted');
        }
        if (($revision['base_version'] ?? 0) !== ($current['version'] ?? -1)) {
            throw new CpfException('REVISION_CONFLICT', 'Current node changed after candidate creation', 4);
        }

        $promoted = $revision;
        unset($promoted['revision_id'], $promoted['base_version'], $promoted['candidate_version'], $promoted['revision_status']);
        $promoted['version'] = $current['version'] + 1;
        $promoted['status'] = 'APPROVED';
        $promoted['approved_by'] = $approvedBy;
        $promoted['approved_at'] = date(DATE_ATOM);
        $promoted['updated_at'] = date(DATE_ATOM);
        $this->store->write($projectDir . '/nodes/' . $nodeId . '.json', $promoted);

        $revision['revision_status'] = 'PROMOTED';
        $revision['promoted_to_version'] = $promoted['version'];
        $revision['approved_by'] = $approvedBy;
        $revision['approved_at'] = $promoted['approved_at'];
        $revision['updated_at'] = $promoted['updated_at'];
        $this->store->write($this->path($projectDir, $nodeId, $revisionId), $revision);
        $this->history->add($projectDir, $nodeId, 'PROMOTE_REVISION', $current['version'], $promoted['version'], $this->changed($current, $promoted), (string)($revision['change_reason'] ?? ''), ['revision_id' => $revisionId, 'approved_by' => $approvedBy]);
        return $promoted;
    }

    public function reject(string $projectDir, string $nodeId, string $revisionId, string $reason): array
    {
        $revision = $this->get($projectDir, $nodeId, $revisionId);
        if (($revision['revision_status'] ?? '') !== 'CANDIDATE') {
            throw new CpfException('REVISION_NOT_CANDIDATE', 'Only candidate revisions can be rejected');
        }
        $revision['revision_status'] = 'REJECTED';
        $revision['rejection_reason'] = $reason;
        $revision['updated_at'] = date(DATE_ATOM);
        $this->store->write($this->path($projectDir, $nodeId, $revisionId), $revision);
        $current = $this->nodes->get($projectDir, $nodeId);
        $this->history->add($projectDir, $nodeId, 'REJECT_REVISION', $current['version'], $current['version'], ['revision_status'], $reason, ['revision_id' => $revisionId]);
        return $revision;
    }

    private function path(string $projectDir, string $nodeId, string $revisionId): string
    {
        return $projectDir . '/revisions/' . $nodeId . '/' . $revisionId . '.json';
    }

    private function changed(array $before, array $after): array
    {
        $keys = [];
        foreach (array_unique(array_merge(array_keys($before), array_keys($after))) as $key) {
            if (($before[$key] ?? null) !== ($after[$key] ?? null) && !in_array($key, ['version', 'updated_at'], true)) {
                $keys[] = $key;
            }
        }
        return $keys;
    }
}
