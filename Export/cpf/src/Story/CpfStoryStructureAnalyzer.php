<?php
declare(strict_types=1);
namespace GK\CPF\Story;

use GK\CPF\Core\{CpfException, CpfNodeManager, JsonStore};

final class CpfStoryStructureAnalyzer
{
    public function __construct(private CpfNodeManager $nodes = new CpfNodeManager(), private JsonStore $store = new JsonStore()) {}

    public function analyze(string $projectDir, string $storyId): array
    {
        $story = $this->nodes->get($projectDir, $storyId);
        if (($story['node_type'] ?? '') !== 'story') throw new CpfException('STORY_NODE_REQUIRED', 'Target node must be story');
        $chapters = array_values(array_filter($this->nodes->all($projectDir), fn(array $n): bool => ($n['node_type'] ?? '') === 'chapter' && in_array($storyId, $n['source_node_ids'] ?? [], true)));
        usort($chapters, fn(array $a, array $b): int => (($a['payload']['order'] ?? 0) <=> ($b['payload']['order'] ?? 0)));

        $issues = []; $warnings = []; $metrics = [];
        $orders = array_map(fn(array $n): int => (int)($n['payload']['order'] ?? 0), $chapters);
        if ($chapters === []) $issues[] = $this->issue('NO_CHAPTERS', 'ERROR', 'No chapters are linked to the story.');
        if ($orders !== [] && $orders !== range(1, count($orders))) $issues[] = $this->issue('CHAPTER_ORDER_GAP', 'ERROR', 'Chapter order must be contiguous from 1.');

        $titles = []; $themes = 0; $summaries = 0; $bosses = 0; $milestones = 0; $joined = [];
        foreach ($chapters as $chapter) {
            $p = $chapter['payload']; $id = $chapter['node_id'];
            $title = trim((string)($p['title'] ?? ''));
            if ($title === '') $issues[] = $this->issue('MISSING_TITLE', 'ERROR', 'Chapter title is missing.', $id);
            elseif (isset($titles[$title])) $warnings[] = $this->issue('DUPLICATE_TITLE', 'WARNING', "Duplicate chapter title: {$title}", $id);
            $titles[$title] = true;
            if (trim((string)($p['theme'] ?? '')) !== '') $themes++; else $warnings[] = $this->issue('MISSING_THEME', 'WARNING', 'Chapter theme is missing.', $id);
            if (trim((string)($p['summary'] ?? '')) !== '') $summaries++; else $warnings[] = $this->issue('MISSING_SUMMARY', 'WARNING', 'Chapter summary is missing.', $id);
            if (($p['boss'] ?? null) !== null && $p['boss'] !== '') $bosses++;
            $milestones += count($p['milestone_ids'] ?? ($p['milestones'] ?? []));
            foreach (($p['joins'] ?? []) as $name) {
                if (isset($joined[$name])) $warnings[] = $this->issue('DUPLICATE_JOIN', 'WARNING', "Character joins more than once: {$name}", $id);
                $joined[$name] = $id;
            }
        }

        $count = count($chapters);
        $metrics = [
            'chapter_count' => $count,
            'theme_coverage_percent' => $count ? round($themes / $count * 100, 1) : 0,
            'summary_coverage_percent' => $count ? round($summaries / $count * 100, 1) : 0,
            'boss_coverage_percent' => $count ? round($bosses / $count * 100, 1) : 0,
            'milestone_count' => $milestones,
            'joined_character_count' => count($joined),
        ];
        if ($count >= 6 && $milestones < $count) $warnings[] = $this->issue('LOW_MILESTONE_DENSITY', 'WARNING', 'Milestone density is below one per chapter.');
        if ($count === 10) {
            $act1 = array_slice($chapters, 0, 3); $act2 = array_slice($chapters, 3, 4); $act3 = array_slice($chapters, 7, 3);
            $metrics['act_distribution'] = ['setup' => count($act1), 'confrontation' => count($act2), 'resolution' => count($act3)];
        }

        $report = [
            'ok' => $issues === [],
            'story_id' => $storyId,
            'analyzed_at' => date(DATE_ATOM),
            'metrics' => $metrics,
            'issues' => $issues,
            'warnings' => $warnings,
            'preview_rebuild_ready' => $issues === [] && $count >= 1,
        ];
        $path = $projectDir . '/analyses/' . $storyId . '-structure.json';
        $this->store->write($path, $report);
        $report['report_path'] = $path;
        return $report;
    }

    private function issue(string $code, string $severity, string $message, ?string $nodeId = null): array
    {
        return array_filter(['code' => $code, 'severity' => $severity, 'message' => $message, 'node_id' => $nodeId], fn(mixed $v): bool => $v !== null);
    }
}
