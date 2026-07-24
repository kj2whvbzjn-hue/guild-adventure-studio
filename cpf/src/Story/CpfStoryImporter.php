<?php
declare(strict_types=1);
namespace GK\CPF\Story;

use GK\CPF\Core\{CpfException, CpfNodeManager, JsonStore};
use GK\CPF\Dependency\CpfDependencyManager;
use Throwable;

final class CpfStoryImporter
{
    public function __construct(
        private CpfNodeManager $nodes = new CpfNodeManager(),
        private CpfDependencyManager $dependencies = new CpfDependencyManager(),
        private JsonStore $store = new JsonStore()
    ) {}

    public function importFile(string $projectDir, string $inputPath, bool $replaceDrafts = false): array
    {
        if (!is_file($inputPath)) throw new CpfException('STORY_INPUT_NOT_FOUND', "Story input not found: {$inputPath}");
        if (filesize($inputPath) > 5 * 1024 * 1024) throw new CpfException('STORY_INPUT_TOO_LARGE', 'Story input exceeds 5 MB', 2);
        $data = json_decode((string)file_get_contents($inputPath), true);
        if (!is_array($data)) throw new CpfException('STORY_INPUT_INVALID', 'Story input must be a JSON object');
        return $this->import($projectDir, $data, $replaceDrafts);
    }

    public function import(string $projectDir, array $input, bool $replaceDrafts = false): array
    {
        $story = $this->normalize($input);
        $errors = $this->validate($story);
        if ($errors !== []) throw new CpfException('STORY_VALIDATION_FAILED', implode('; ', $errors), 2);

        $normalizedJson = $this->canonicalJson($story);
        $normalizedHash = hash('sha256', $normalizedJson);
        $sourceHash = hash('sha256', $this->canonicalJson($input));
        $storyId = $story['story_id'];
        $latestPath = $projectDir . '/imports/' . $storyId . '/latest.json';
        $latest = $this->store->read($latestPath, null);
        if (is_array($latest) && ($latest['normalized_hash'] ?? '') === $normalizedHash) {
            return [
                'ok' => true,
                'idempotent' => true,
                'story_id' => $storyId,
                'chapter_count' => count($story['chapters']),
                'created_node_ids' => [],
                'updated_node_ids' => [],
                'archived_node_ids' => [],
                'normalized_snapshot' => (string)($latest['snapshot_path'] ?? $latestPath),
                'import_id' => (string)($latest['import_id'] ?? ''),
            ];
        }

        $lock = new CpfImportLock();
        $transaction = new CpfImportTransaction();
        $lock->acquire($projectDir);
        try {
            // Recheck after lock to avoid a race with another completed import.
            $latest = $this->store->read($latestPath, null);
            if (is_array($latest) && ($latest['normalized_hash'] ?? '') === $normalizedHash) {
                return [
                    'ok' => true, 'idempotent' => true, 'story_id' => $storyId,
                    'chapter_count' => count($story['chapters']), 'created_node_ids' => [],
                    'updated_node_ids' => [], 'archived_node_ids' => [],
                    'normalized_snapshot' => (string)($latest['snapshot_path'] ?? $latestPath),
                    'import_id' => (string)($latest['import_id'] ?? ''),
                ];
            }

            $transaction->begin($projectDir);
            $result = $this->applyImport($projectDir, $story, $replaceDrafts);
            $revision = $this->nextRevision($projectDir, $storyId);
            $importId = $storyId . '-IMP-' . str_pad((string)$revision, 4, '0', STR_PAD_LEFT);
            $snapshotPath = $projectDir . '/imports/' . $storyId . '/' . str_pad((string)$revision, 4, '0', STR_PAD_LEFT) . '.json';
            $snapshot = [
                'import_id' => $importId,
                'revision' => $revision,
                'timestamp' => date(DATE_ATOM),
                'source_hash' => $sourceHash,
                'normalized_hash' => $normalizedHash,
                'story' => $story,
            ];
            $this->store->write($snapshotPath, $snapshot);
            $this->store->write($latestPath, [
                'import_id' => $importId,
                'revision' => $revision,
                'timestamp' => $snapshot['timestamp'],
                'source_hash' => $sourceHash,
                'normalized_hash' => $normalizedHash,
                'snapshot_path' => $snapshotPath,
            ]);
            $transaction->commit();
            return $result + [
                'idempotent' => false,
                'import_id' => $importId,
                'normalized_snapshot' => $snapshotPath,
                'source_hash' => $sourceHash,
                'normalized_hash' => $normalizedHash,
            ];
        } catch (Throwable $e) {
            $transaction->rollback($projectDir);
            throw $e;
        } finally {
            $lock->release();
        }
    }

    private function applyImport(string $projectDir, array $story, bool $replaceDrafts): array
    {
        $storyId = $story['story_id'];
        $created = []; $updated = []; $archived = [];
        $desiredIds = [$storyId => true];
        $storyPayload = [
            'title' => $story['title'], 'premise' => $story['premise'],
            'themes' => $story['themes'], 'ending_goal' => $story['ending_goal'],
            'chapter_count' => count($story['chapters']), 'source_format' => $story['source_format'],
        ];
        $storyNode = $this->upsertDraft($projectDir, $storyId, 'story', $storyPayload, $replaceDrafts);
        if ($storyNode['created']) $created[] = $storyId; else $updated[] = $storyId;

        $desiredDependencies = [];
        foreach ($story['chapters'] as $chapter) {
            $chapterId = $chapter['chapter_id'];
            $desiredIds[$chapterId] = true;
            $milestoneIds = [];
            foreach ($chapter['milestones'] as $index => $_) $milestoneIds[] = $chapterId . '_MS' . str_pad((string)($index + 1), 3, '0', STR_PAD_LEFT);
            $payload = $chapter;
            unset($payload['chapter_id'], $payload['milestones']);
            $payload['milestone_ids'] = $milestoneIds;
            $result = $this->upsertDraft($projectDir, $chapterId, 'chapter', $payload, $replaceDrafts, ['source_node_ids' => [$storyId]]);
            if ($result['created']) $created[] = $chapterId; else $updated[] = $chapterId;
            $desiredDependencies[] = $this->dependency($storyId, $chapterId, 'PARENT', 'HIGH');

            foreach ($chapter['milestones'] as $index => $milestone) {
                $milestoneId = $milestoneIds[$index];
                $desiredIds[$milestoneId] = true;
                $milestonePayload = is_array($milestone) ? $milestone : ['description' => (string)$milestone];
                $milestonePayload['chapter_id'] = $chapterId;
                $mResult = $this->upsertDraft($projectDir, $milestoneId, 'milestone', $milestonePayload, $replaceDrafts, ['source_node_ids' => [$chapterId]]);
                if ($mResult['created']) $created[] = $milestoneId; else $updated[] = $milestoneId;
                $desiredDependencies[] = $this->dependency($chapterId, $milestoneId, 'CONTAINS', 'MEDIUM');
            }
        }

        $managedIds = $this->managedNodeIds($projectDir, $storyId);
        foreach ($managedIds as $nodeId) {
            if (isset($desiredIds[$nodeId]) || $nodeId === $storyId) continue;
            $node = $this->nodes->get($projectDir, $nodeId);
            if (($node['locked'] ?? false) || in_array($node['status'] ?? '', ['APPROVED', 'LOCKED'], true)) {
                throw new CpfException('STORY_CHILD_PROTECTED', "Removed child is protected: {$nodeId}", 3);
            }
            $this->nodes->setStatus($projectDir, $nodeId, 'ARCHIVED', ['archive_reason' => 'removed by story import']);
            $archived[] = $nodeId;
        }
        $this->replaceManagedDependencies($projectDir, array_values(array_unique(array_merge($managedIds, array_keys($desiredIds)))), $desiredDependencies);

        return [
            'ok' => true, 'story_id' => $storyId, 'chapter_count' => count($story['chapters']),
            'created_node_ids' => array_values(array_unique($created)),
            'updated_node_ids' => array_values(array_unique($updated)),
            'archived_node_ids' => array_values(array_unique($archived)),
        ];
    }

    public function normalize(array $input): array
    {
        $storyId = $this->id((string)($input['story_id'] ?? 'STORY001'), 'STORY001');
        $chapters = [];
        foreach (($input['chapters'] ?? []) as $i => $raw) {
            if (!is_array($raw)) continue;
            $order = (int)($raw['order'] ?? $raw['chapter_no'] ?? ($i + 1));
            $chapterId = $this->id((string)($raw['chapter_id'] ?? sprintf('CH%03d', $order)), sprintf('CH%03d', $order));
            $chapters[] = [
                'chapter_id' => $chapterId, 'order' => $order,
                'title' => trim((string)($raw['title'] ?? $raw['name'] ?? '')),
                'theme' => trim((string)($raw['theme'] ?? '')),
                'summary' => trim((string)($raw['summary'] ?? $raw['synopsis'] ?? '')),
                'boss' => $raw['boss'] ?? null,
                'characters' => $this->stringList($raw['characters'] ?? $raw['cast'] ?? []),
                'joins' => $this->stringList($raw['joins'] ?? []),
                'locations' => $this->stringList($raw['locations'] ?? []),
                'milestones' => array_values(is_array($raw['milestones'] ?? null) ? $raw['milestones'] : []),
                'locked_fields' => $this->stringList($raw['locked_fields'] ?? []),
            ];
        }
        usort($chapters, fn(array $a, array $b): int => $a['order'] <=> $b['order']);
        return [
            'story_id' => $storyId, 'title' => trim((string)($input['title'] ?? '')),
            'premise' => trim((string)($input['premise'] ?? $input['summary'] ?? '')),
            'themes' => $this->stringList($input['themes'] ?? []),
            'ending_goal' => trim((string)($input['ending_goal'] ?? '')),
            'source_format' => (string)($input['source_format'] ?? 'cpf-story-json-v1'),
            'chapters' => $chapters,
        ];
    }

    public function validate(array $story): array
    {
        $errors = [];
        if ($story['title'] === '') $errors[] = 'story.title is required';
        if ($this->textLength($story['title']) > 200) $errors[] = 'story.title exceeds 200 characters';
        $count = count($story['chapters']);
        if ($count < 1 || $count > 20) $errors[] = 'chapters must contain 1 to 20 items';
        $orders = []; $ids = [];
        foreach ($story['chapters'] as $chapter) {
            if ($chapter['order'] < 1 || $chapter['order'] > 20) $errors[] = "chapter order out of range: {$chapter['order']}";
            if ($chapter['title'] === '') $errors[] = "chapter title is required: {$chapter['chapter_id']}";
            if ($this->textLength($chapter['title']) > 200) $errors[] = "chapter title exceeds 200 characters: {$chapter['chapter_id']}";
            if (count($chapter['milestones']) > 100) $errors[] = "milestones exceed 100 items: {$chapter['chapter_id']}";
            if (isset($orders[$chapter['order']])) $errors[] = "duplicate chapter order: {$chapter['order']}";
            if (isset($ids[$chapter['chapter_id']])) $errors[] = "duplicate chapter_id: {$chapter['chapter_id']}";
            $orders[$chapter['order']] = true; $ids[$chapter['chapter_id']] = true;
        }
        return array_values(array_unique($errors));
    }

    private function upsertDraft(string $dir, string $id, string $type, array $payload, bool $replaceDrafts, array $meta = []): array
    {
        try {
            $current = $this->nodes->get($dir, $id);
            if (!$replaceDrafts) throw new CpfException('STORY_NODE_EXISTS', "Node already exists: {$id}", 2);
            if (($current['locked'] ?? false) || !in_array($current['status'] ?? '', ['DRAFT', 'REJECTED', 'ARCHIVED'], true)) {
                throw new CpfException('STORY_NODE_PROTECTED', "Only unlocked DRAFT/REJECTED/ARCHIVED nodes may be replaced: {$id}", 3);
            }
            $manualFields = array_values(array_unique(array_merge($current['manual_fields'] ?? [], $payload['locked_fields'] ?? [])));
            unset($payload['locked_fields']);
            $patch = ['payload' => $payload, 'manual_fields' => $manualFields, 'status' => 'DRAFT'] + $meta;
            return ['created' => false, 'node' => $this->nodes->update($dir, $id, $patch, 'story import replace draft')];
        } catch (CpfException $e) {
            if ($e->errorCode !== 'NODE_NOT_FOUND') throw $e;
        }
        $manualFields = $payload['locked_fields'] ?? [];
        unset($payload['locked_fields']);
        return ['created' => true, 'node' => $this->nodes->create($dir, $id, $type, $payload, $meta + ['manual_fields' => $manualFields])];
    }

    private function managedNodeIds(string $dir, string $storyId): array
    {
        $ids = [$storyId];
        foreach ($this->dependencies->all($dir) as $dep) {
            if (($dep['source_node_id'] ?? '') === $storyId && ($dep['dependency_type'] ?? '') === 'PARENT') $ids[] = $dep['target_node_id'];
        }
        $chapterIds = $ids;
        foreach ($this->dependencies->all($dir) as $dep) {
            if (in_array($dep['source_node_id'] ?? '', $chapterIds, true) && ($dep['dependency_type'] ?? '') === 'CONTAINS') $ids[] = $dep['target_node_id'];
        }
        return array_values(array_unique($ids));
    }

    private function replaceManagedDependencies(string $dir, array $managedIds, array $desired): void
    {
        $managed = array_fill_keys($managedIds, true);
        $kept = [];
        foreach ($this->dependencies->all($dir) as $dep) {
            if (isset($managed[$dep['source_node_id'] ?? '']) && in_array($dep['dependency_type'] ?? '', ['PARENT', 'CONTAINS'], true)) continue;
            $kept[] = $dep;
        }
        $all = array_merge($kept, $desired);
        foreach ($all as $i => &$dep) $dep['dependency_id'] = sprintf('DEP_%06d', $i + 1);
        unset($dep);
        $this->store->write($dir . '/dependencies/dependencies.json', $all);
    }

    private function dependency(string $source, string $target, string $type, string $impact): array
    {
        return ['dependency_id' => '', 'source_node_id' => $source, 'target_node_id' => $target, 'dependency_type' => $type, 'impact_level' => $impact];
    }

    private function nextRevision(string $dir, string $storyId): int
    {
        $latest = $this->store->read($dir . '/imports/' . $storyId . '/latest.json', null);
        return is_array($latest) ? ((int)($latest['revision'] ?? 0) + 1) : 1;
    }

    private function canonicalJson(array $data): string
    {
        $normalize = function (&$value) use (&$normalize): void {
            if (!is_array($value)) return;
            foreach ($value as &$item) $normalize($item);
            unset($item);
            if (!array_is_list($value)) ksort($value);
        };
        $copy = $data; $normalize($copy);
        return (string)json_encode($copy, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function textLength(string $value): int
    {
        return function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
    }

    private function stringList(mixed $value): array
    {
        if (!is_array($value)) return [];
        return array_values(array_filter(array_map(fn($v): string => trim((string)$v), $value), fn(string $v): bool => $v !== ''));
    }

    private function id(string $value, string $fallback): string
    {
        $value = strtoupper(trim($value));
        $value = preg_replace('/[^A-Z0-9_-]+/', '_', $value) ?: '';
        return $value !== '' ? $value : $fallback;
    }
}
