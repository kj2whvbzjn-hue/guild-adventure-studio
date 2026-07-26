<?php
declare(strict_types=1);
namespace GK\CPF\Demo;

use GK\CPF\Core\{CpfException, CpfNodeManager};
use GK\CPF\Generation\CpfGeneratorRegistry;
use GK\CPF\Revision\CpfRevisionRepository;

final class CpfDemoCandidateGenerator
{
    private const ACCEPTED = ['APPROVED', 'LOCKED'];
    private const TARGETS = [
        'plot' => ['source_type' => 'story', 'prefix' => 'PLOT_DEMO', 'title' => 'デモ用プロット候補'],
        'section' => ['source_type' => 'chapter', 'prefix' => 'SEC_DEMO', 'title' => 'デモ用セクション候補'],
        'scene' => ['source_type' => 'section', 'prefix' => 'SCN_DEMO', 'title' => 'デモ用シーン候補'],
        'event' => ['source_type' => 'scene', 'prefix' => 'EV_DEMO', 'title' => 'デモ用イベント候補'],
    ];

    public function __construct(
        private CpfNodeManager $nodes = new CpfNodeManager(),
        private CpfRevisionRepository $revisions = new CpfRevisionRepository(),
        private CpfGeneratorRegistry $registry = new CpfGeneratorRegistry()
    ) {}

    public function generate(string $projectDir, ?string $registryPath = null): array
    {
        $registryPath ??= dirname(__DIR__, 2) . '/config/generator-registry.json';
        $all = $this->nodes->all($projectDir);
        $generated = [];
        $blocked = [];

        foreach (self::TARGETS as $targetType => $spec) {
            $source = $this->firstAccepted($all, $spec['source_type']);
            if ($source === null) {
                $blocked[] = [
                    'code' => 'DEMO_CANDIDATE_SOURCE_MISSING',
                    'target_type' => $targetType,
                    'source_type' => $spec['source_type'],
                    'message' => strtoupper($spec['source_type']) . ' のAPPROVEDまたはLOCKED Nodeが必要です。',
                ];
                continue;
            }

            $generator = $this->registry->resolve($registryPath, $targetType, null, ['candidate_revision']);
            $base = $this->firstByType($all, $targetType);
            if ($base === null) {
                $nodeId = $this->nextNodeId($all, $spec['prefix']);
                $base = $this->nodes->create($projectDir, $nodeId, $targetType, [
                    'title' => $spec['title'],
                    'generation_state' => 'SCAFFOLD',
                ], [
                    'generator_id' => $generator['generator_id'],
                    'generator_version' => $generator['version'],
                    'source_node_ids' => [$source['node_id']],
                    'change_reason' => 'demo candidate scaffold',
                ]);
                $all[] = $base;
            }

            if ($this->hasOpenCandidate($projectDir, (string)$base['node_id'])) {
                $blocked[] = [
                    'code' => 'DEMO_CANDIDATE_ALREADY_EXISTS',
                    'target_type' => $targetType,
                    'node_id' => $base['node_id'],
                    'message' => '未処理のCandidate Revisionが既にあります。',
                ];
                continue;
            }

            $candidate = $this->revisions->createCandidate($projectDir, (string)$base['node_id'], [
                'generator_id' => $generator['generator_id'],
                'generator_version' => $generator['version'],
                'source_node_ids' => [$source['node_id']],
                'payload' => [
                    'title' => $spec['title'],
                    'generation_state' => 'CANDIDATE',
                    'source_node_id' => $source['node_id'],
                    'source_node_type' => $source['node_type'],
                    'review_required' => true,
                ],
            ], 'デモ版最小経路の不足Node候補を生成');

            $generated[] = [
                'target_type' => $targetType,
                'node_id' => $base['node_id'],
                'revision_id' => $candidate['revision_id'],
                'source_node_id' => $source['node_id'],
                'proposed_dependency' => [
                    'source_node_id' => $source['node_id'],
                    'target_node_id' => $base['node_id'],
                    'dependency_type' => 'GENERATES',
                    'impact_level' => 'HIGH',
                ],
            ];
        }

        return [
            'ok' => true,
            'mode' => 'scaffold_and_candidate',
            'human_approval_required' => true,
            'generated' => $generated,
            'blocked' => $blocked,
            'next_action' => $generated === []
                ? 'Blocking理由を解消してください。'
                : 'Candidate Revisionをレビューし、承認後に昇格と依存関係登録を行ってください。',
        ];
    }

    private function firstAccepted(array $nodes, string $type): ?array
    {
        foreach ($nodes as $node) {
            if (($node['node_type'] ?? '') === $type && in_array((string)($node['status'] ?? ''), self::ACCEPTED, true)) return $node;
        }
        return null;
    }

    private function firstByType(array $nodes, string $type): ?array
    {
        foreach ($nodes as $node) if (($node['node_type'] ?? '') === $type) return $node;
        return null;
    }

    private function hasOpenCandidate(string $projectDir, string $nodeId): bool
    {
        foreach ($this->revisions->list($projectDir, $nodeId) as $revision) {
            if (($revision['revision_status'] ?? '') === 'CANDIDATE') return true;
        }
        return false;
    }

    private function nextNodeId(array $nodes, string $prefix): string
    {
        $used = array_fill_keys(array_map(static fn(array $n): string => (string)($n['node_id'] ?? ''), $nodes), true);
        for ($i = 1; $i <= 999999; $i++) {
            $id = sprintf('%s_%03d', $prefix, $i);
            if (!isset($used[$id])) return $id;
        }
        throw new CpfException('DEMO_NODE_ID_EXHAUSTED', 'Demo node id range exhausted');
    }
}
