<?php
declare(strict_types=1);
namespace GK\CPF\Demo;

use GK\CPF\Core\CpfNodeManager;
use GK\CPF\Dependency\CpfDependencyManager;

final class CpfDemoReadinessGate
{
    private const REQUIRED_PATH = ['story', 'plot', 'chapter', 'section', 'scene', 'event'];
    private const ACCEPTED_STATUSES = ['APPROVED', 'LOCKED'];

    public function __construct(
        private CpfNodeManager $nodes = new CpfNodeManager(),
        private CpfDependencyManager $dependencies = new CpfDependencyManager()
    ) {}

    public function evaluate(string $projectDir): array
    {
        $nodes = $this->nodes->all($projectDir);
        $byId = [];
        $approvedByType = [];
        foreach ($nodes as $node) {
            $id = (string)($node['node_id'] ?? '');
            if ($id !== '') $byId[$id] = $node;
            $type = (string)($node['node_type'] ?? '');
            if ($type !== '' && in_array((string)($node['status'] ?? ''), self::ACCEPTED_STATUSES, true)) {
                $approvedByType[$type][] = $node;
            }
        }

        $blocking = [];
        foreach (self::REQUIRED_PATH as $type) {
            if (($approvedByType[$type] ?? []) === []) {
                $blocking[] = $this->issue(
                    'DEMO_REQUIRED_NODE_MISSING',
                    strtoupper($type) . ' のAPPROVEDまたはLOCKED Nodeがありません。',
                    ['node_type' => $type]
                );
            }
        }

        $edges = $this->dependencies->all($projectDir);
        $pathEdges = [
            ['story', 'plot'],
            ['plot', 'chapter'],
            ['chapter', 'section'],
            ['section', 'scene'],
            ['scene', 'event'],
        ];
        $connectedEdges = [];
        foreach ($pathEdges as [$fromType, $toType]) {
            $match = $this->findApprovedEdge($edges, $byId, $fromType, $toType);
            if ($match === null) {
                $blocking[] = $this->issue(
                    'DEMO_REQUIRED_DEPENDENCY_MISSING',
                    "$fromType から $toType への承認済み経路がありません。",
                    ['from_type' => $fromType, 'to_type' => $toType]
                );
            } else {
                $connectedEdges[] = $match;
            }
        }

        $warnings = [];
        $eventNodes = $approvedByType['event'] ?? [];
        foreach ($eventNodes as $event) {
            $payload = is_array($event['payload'] ?? null) ? $event['payload'] : [];
            if (trim((string)($payload['title'] ?? $payload['name'] ?? '')) === '') {
                $warnings[] = $this->issue('DEMO_EVENT_TITLE_MISSING', 'Eventの表示名がありません。', ['node_id' => $event['node_id'] ?? null]);
            }
        }

        $counts = [];
        foreach (self::REQUIRED_PATH as $type) $counts[$type] = count($approvedByType[$type] ?? []);

        return [
            'ok' => $blocking === [],
            'gate' => 'demo-foundation-readiness',
            'evaluated_at' => date(DATE_ATOM),
            'required_path' => self::REQUIRED_PATH,
            'approved_node_counts' => $counts,
            'connected_edges' => $connectedEdges,
            'blocking_issues' => $blocking,
            'warnings' => $warnings,
            'next_action' => $this->nextAction($blocking),
        ];
    }

    private function findApprovedEdge(array $edges, array $byId, string $fromType, string $toType): ?array
    {
        foreach ($edges as $edge) {
            $source = $byId[(string)($edge['source_node_id'] ?? '')] ?? null;
            $target = $byId[(string)($edge['target_node_id'] ?? '')] ?? null;
            if (!is_array($source) || !is_array($target)) continue;
            if (($source['node_type'] ?? '') !== $fromType || ($target['node_type'] ?? '') !== $toType) continue;
            if (!in_array((string)($source['status'] ?? ''), self::ACCEPTED_STATUSES, true)) continue;
            if (!in_array((string)($target['status'] ?? ''), self::ACCEPTED_STATUSES, true)) continue;
            return [
                'source_node_id' => $source['node_id'],
                'target_node_id' => $target['node_id'],
                'from_type' => $fromType,
                'to_type' => $toType,
            ];
        }
        return null;
    }

    private function nextAction(array $blocking): string
    {
        if ($blocking === []) return 'Runtime Export用のデモデータ検証へ進めます。';
        $first = $blocking[0];
        return match ($first['code'] ?? '') {
            'DEMO_REQUIRED_NODE_MISSING' => '不足しているNodeを作成し、人間のレビュー後にAPPROVEDへ昇格してください。',
            'DEMO_REQUIRED_DEPENDENCY_MISSING' => '承認済みNode間の依存関係を登録してください。',
            default => 'Blocking Issueを解消してください。',
        };
    }

    private function issue(string $code, string $message, array $context = []): array
    {
        return ['code' => $code, 'severity' => 'BLOCKING', 'message' => $message, 'context' => array_filter($context, static fn(mixed $v): bool => $v !== null && $v !== '')];
    }
}
