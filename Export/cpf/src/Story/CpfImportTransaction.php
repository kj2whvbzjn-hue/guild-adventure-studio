<?php
declare(strict_types=1);
namespace GK\CPF\Story;

use GK\CPF\Core\CpfException;

final class CpfImportTransaction
{
    private ?string $backupDir = null;
    private array $targets = ['nodes', 'history', 'dependencies', 'imports', 'revisions'];

    public function begin(string $projectDir): void
    {
        $base = $projectDir . '/transactions';
        @mkdir($base, 0777, true);
        $this->backupDir = $base . '/story-import-' . date('YmdHis') . '-' . bin2hex(random_bytes(4));
        if (!mkdir($this->backupDir, 0777, true)) {
            throw new CpfException('STORY_TRANSACTION_FAILED', 'Cannot create transaction backup', 5);
        }
        foreach ($this->targets as $target) {
            $source = $projectDir . '/' . $target;
            if (is_dir($source)) $this->copyDirectory($source, $this->backupDir . '/' . $target);
        }
    }

    public function commit(): void
    {
        if ($this->backupDir !== null) $this->removeDirectory($this->backupDir);
        $this->backupDir = null;
    }

    public function rollback(string $projectDir): void
    {
        if ($this->backupDir === null) return;
        foreach ($this->targets as $target) {
            $current = $projectDir . '/' . $target;
            $this->removeDirectory($current);
            $backup = $this->backupDir . '/' . $target;
            if (is_dir($backup)) $this->copyDirectory($backup, $current);
        }
        $this->removeDirectory($this->backupDir);
        $this->backupDir = null;
    }

    private function copyDirectory(string $source, string $destination): void
    {
        @mkdir($destination, 0777, true);
        foreach (array_diff(scandir($source) ?: [], ['.', '..']) as $item) {
            $from = $source . '/' . $item;
            $to = $destination . '/' . $item;
            if (is_link($from)) throw new CpfException('STORY_TRANSACTION_SYMLINK', 'Symlinks are not allowed in CPF project data', 5);
            is_dir($from) ? $this->copyDirectory($from, $to) : copy($from, $to);
        }
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) return;
        foreach (array_diff(scandir($dir) ?: [], ['.', '..']) as $item) {
            $path = $dir . '/' . $item;
            is_dir($path) && !is_link($path) ? $this->removeDirectory($path) : @unlink($path);
        }
        @rmdir($dir);
    }
}
