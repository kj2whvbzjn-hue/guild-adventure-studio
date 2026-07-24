<?php
declare(strict_types=1);
namespace GK\CPF\Workflow;

use GK\CPF\Core\{CpfException, CpfNodeManager, JsonStore};

final class CpfWorkflowManager
{
    public function __construct(private JsonStore $store = new JsonStore(), private CpfNodeManager $nodes = new CpfNodeManager()) {}

    public function assertGenerationAllowed(string $projectDir, string $targetType, array $sourceIds, string $configPath): void
    {
        $graph = $this->store->read($configPath, []);
        $edges = array_values(array_filter($graph['edges'] ?? [], static fn(array $e): bool => ($e['to'] ?? null) === $targetType));
        if ($edges === []) return;

        $matched = 0;
        foreach ($sourceIds as $sourceId) {
            $source = $this->nodes->get($projectDir, $sourceId);
            foreach ($edges as $edge) {
                if (($edge['from'] ?? null) !== $source['node_type']) continue;
                $matched++;
                if (($edge['requires_approval'] ?? false) && !in_array($source['status'], ['APPROVED', 'LOCKED'], true)) {
                    throw new CpfException('APPROVAL_GATE_NOT_MET', "Source $sourceId requires approval", 2);
                }
            }
        }
        $minimum = min(array_map(static fn(array $e): int => (int)($e['min_count'] ?? 1), $edges));
        if ($matched < $minimum) {
            throw new CpfException('WORKFLOW_SOURCE_MISSING', "Insufficient source nodes for $targetType");
        }
    }

    public function validateGraph(string $configPath): array
    {
        $graph = $this->store->read($configPath, []);
        $nodeTypes = $graph['nodes'] ?? [];
        $edges = $graph['edges'] ?? [];
        $errors = [];
        if (!is_array($nodeTypes) || $nodeTypes === []) $errors[] = 'missing_node_types';
        if (count($nodeTypes) !== count(array_unique($nodeTypes))) $errors[] = 'duplicate_node_type';

        $adjacency = [];
        $incoming = array_fill_keys($nodeTypes, 0);
        foreach ($edges as $index => $edge) {
            $from = $edge['from'] ?? null;
            $to = $edge['to'] ?? null;
            if (!in_array($from, $nodeTypes, true) || !in_array($to, $nodeTypes, true)) {
                $errors[] = "undefined_node_type:$index";
                continue;
            }
            if (!array_key_exists('requires_approval', $edge) || !is_bool($edge['requires_approval'])) {
                $errors[] = "approval_gate_missing:$from->$to";
            }
            $min = (int)($edge['min_count'] ?? 1);
            $max = $edge['max_count'] ?? null;
            if ($min < 0 || ($max !== null && ((int)$max < $min))) $errors[] = "invalid_count:$from->$to";
            $adjacency[$from][] = $to;
            $incoming[$to]++;
        }

        $roots = $graph['roots'] ?? array_keys(array_filter($incoming, static fn(int $count): bool => $count === 0));
        foreach ($roots as $root) if (!in_array($root, $nodeTypes, true)) $errors[] = "undefined_root:$root";

        $visited = [];
        $visiting = [];
        $cycle = false;
        $walk = function (string $node) use (&$walk, &$visited, &$visiting, &$adjacency, &$cycle): void {
            if (isset($visiting[$node])) { $cycle = true; return; }
            if (isset($visited[$node])) return;
            $visiting[$node] = true;
            foreach ($adjacency[$node] ?? [] as $next) $walk($next);
            unset($visiting[$node]);
            $visited[$node] = true;
        };
        foreach ($roots as $root) $walk($root);
        if ($cycle) $errors[] = 'cycle';
        foreach ($nodeTypes as $nodeType) if (!isset($visited[$nodeType])) $errors[] = "unreachable:$nodeType";

        foreach (($graph['required_nodes'] ?? []) as $required) {
            if (!in_array($required, $nodeTypes, true)) $errors[] = "required_step_missing:$required";
        }
        foreach (($graph['required_approval_edges'] ?? []) as $requiredEdge) {
            $found = false;
            foreach ($edges as $edge) {
                if (($edge['from'] ?? null) === ($requiredEdge['from'] ?? null) && ($edge['to'] ?? null) === ($requiredEdge['to'] ?? null) && ($edge['requires_approval'] ?? false) === true) {
                    $found = true; break;
                }
            }
            if (!$found) $errors[] = 'required_approval_gate_missing:' . ($requiredEdge['from'] ?? '?') . '->' . ($requiredEdge['to'] ?? '?');
        }
        return array_values(array_unique($errors));
    }
}
