<?php
declare(strict_types=1);

namespace GK\Export;

/**
 * Stable game-facing access layer. Game code should depend on this class,
 * not on Export JSON paths or envelope structure.
 */
final class GameMasterRepository
{
    /** @var array<string,string> */
    public const COLLECTION_PATHS = [
        'jobs' => 'master/jobs.json',
        'statuses' => 'master/statuses.json',
        'skills' => 'skill/skills.json',
        'equipment' => 'equipment/equipment.json',
        'equipment_mods' => 'equipment/mods.json',
        'monsters' => 'monster/monsters.json',
        'monster_mods' => 'monster/monster_mods.json',
        'stones' => 'stone/stones.json',
        'stone_mods' => 'stone/stone_mods.json',
        'main_quests' => 'quest/main_quests.json',
        'sub_quests' => 'quest/sub_quests.json',
        'event_quests' => 'quest/event_quests.json',
        'chapters' => 'scenario/chapters.json',
        'sections' => 'scenario/sections.json',
        'scenes' => 'scenario/scenes.json',
        'events' => 'event/events.json',
        'flags' => 'event/flags.json',
        'ai_nodes' => 'ai/ai_nodes.json',
        'ai_templates' => 'ai/ai_templates.json',
        'drop_tables' => 'system/drop_tables.json',
    ];

    /** @var array<string,RecordCollection> */
    private array $collections = [];

    public function __construct(private readonly ExportPackage $package)
    {
        foreach (self::COLLECTION_PATHS as $name => $path) {
            $this->collections[$name] = new RecordCollection($path, $package->data($path));
        }
    }

    public function collection(string $name): RecordCollection
    {
        if (!isset($this->collections[$name])) {
            throw new ExportLoadException('REPOSITORY_COLLECTION_UNKNOWN', "Unknown master collection: {$name}", ['collection' => $name]);
        }
        return $this->collections[$name];
    }

    public function jobs(): RecordCollection { return $this->collection('jobs'); }
    public function statuses(): RecordCollection { return $this->collection('statuses'); }
    public function skills(): RecordCollection { return $this->collection('skills'); }
    public function equipment(): RecordCollection { return $this->collection('equipment'); }
    public function monsters(): RecordCollection { return $this->collection('monsters'); }
    public function mainQuests(): RecordCollection { return $this->collection('main_quests'); }
    public function subQuests(): RecordCollection { return $this->collection('sub_quests'); }
    public function eventQuests(): RecordCollection { return $this->collection('event_quests'); }
    public function chapters(): RecordCollection { return $this->collection('chapters'); }
    public function sections(): RecordCollection { return $this->collection('sections'); }
    public function scenes(): RecordCollection { return $this->collection('scenes'); }
    public function events(): RecordCollection { return $this->collection('events'); }
    public function flags(): RecordCollection { return $this->collection('flags'); }
    public function dropTables(): RecordCollection { return $this->collection('drop_tables'); }

    /** @return array<string,mixed> */
    public function balance(): array
    {
        $data = $this->package->data('system/balance.json');
        if (!is_array($data) || array_is_list($data)) {
            throw new ExportLoadException('REPOSITORY_DATA_INVALID', 'Balance data must be an object.', ['path' => 'system/balance.json']);
        }
        return $data;
    }

    /** @return array<string,mixed> */
    public function gameSettings(): array
    {
        $data = $this->package->data('system/game_settings.json');
        if (!is_array($data) || array_is_list($data)) {
            throw new ExportLoadException('REPOSITORY_DATA_INVALID', 'Game settings data must be an object.', ['path' => 'system/game_settings.json']);
        }
        return $data;
    }

    public function package(): ExportPackage { return $this->package; }
}
