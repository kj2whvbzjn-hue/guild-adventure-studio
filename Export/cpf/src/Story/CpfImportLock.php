<?php
declare(strict_types=1);
namespace GK\CPF\Story;

use GK\CPF\Core\CpfException;

final class CpfImportLock
{
    private ?string $path = null;

    public function acquire(string $projectDir, int $staleSeconds = 300): void
    {
        $lockDir = $projectDir . '/locks';
        @mkdir($lockDir, 0777, true);
        $path = $lockDir . '/story-import.lock';
        if (@mkdir($path, 0777)) {
            $this->path = $path;
            file_put_contents($path . '/owner.json', json_encode([
                'pid' => getmypid(),
                'created_at' => date(DATE_ATOM),
                'created_unix' => time(),
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
            return;
        }

        $owner = $path . '/owner.json';
        $created = is_file($owner) ? (int)((json_decode((string)file_get_contents($owner), true)['created_unix'] ?? 0)) : 0;
        if ($created > 0 && time() - $created > $staleSeconds) {
            $this->removeDirectory($path);
            if (@mkdir($path, 0777)) {
                $this->path = $path;
                file_put_contents($path . '/owner.json', json_encode([
                    'pid' => getmypid(),
                    'created_at' => date(DATE_ATOM),
                    'created_unix' => time(),
                    'recovered_stale_lock' => true,
                ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
                return;
            }
        }
        throw new CpfException('STORY_IMPORT_LOCKED', 'Another story import is already running', 4);
    }

    public function release(): void
    {
        if ($this->path !== null) {
            $this->removeDirectory($this->path);
            $this->path = null;
        }
    }

    public function __destruct()
    {
        $this->release();
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) return;
        foreach (array_diff(scandir($dir) ?: [], ['.', '..']) as $item) {
            $path = $dir . '/' . $item;
            is_dir($path) ? $this->removeDirectory($path) : @unlink($path);
        }
        @rmdir($dir);
    }
}
