<?php
declare(strict_types=1);
namespace GK\CPF\Migration;

use GK\CPF\Core\{CpfException, JsonStore};

final class CpfMigrationManager
{
    public function __construct(private JsonStore $store = new JsonStore()) {}

    public function status(string $projectDir): array
    {
        return $this->store->read($projectDir . '/migrations/state.json', ['schema_version' => 1, 'applied' => []]);
    }

    public function migrate(string $projectDir, int $targetVersion): array
    {
        $state = $this->status($projectDir);
        $current = (int)($state['schema_version'] ?? 1);
        if ($targetVersion < $current) {
            throw new CpfException('MIGRATION_DOWNGRADE_UNSUPPORTED', 'Downgrade migration is not supported');
        }
        for ($version = $current + 1; $version <= $targetVersion; $version++) {
            $method = 'toVersion' . $version;
            if (!method_exists($this, $method)) {
                throw new CpfException('MIGRATION_NOT_FOUND', "Migration not found for version $version");
            }
            $this->{$method}($projectDir);
            $state['schema_version'] = $version;
            $state['applied'][] = ['version' => $version, 'applied_at' => date(DATE_ATOM)];
            $this->store->write($projectDir . '/migrations/state.json', $state);
        }
        return $state;
    }

    private function toVersion2(string $projectDir): void
    {
        foreach (['revisions', 'migrations'] as $directory) {
            if (!is_dir($projectDir . '/' . $directory) && !mkdir($projectDir . '/' . $directory, 0777, true) && !is_dir($projectDir . '/' . $directory)) {
                throw new CpfException('MIGRATION_FAILED', "Cannot create $directory");
            }
        }
        $project = $this->store->read($projectDir . '/project.json', null);
        if (!is_array($project)) throw new CpfException('PROJECT_NOT_FOUND', 'Project not found');
        $project['schema_version'] = 2;
        $project['updated_at'] = date(DATE_ATOM);
        $this->store->write($projectDir . '/project.json', $project);
    }
}
