<?php
declare(strict_types=1);
namespace GK\CPF\Core;

final class CpfProjectMutation
{
    private ?string $lockPath = null;
    private ?string $backupDir = null;

    public function execute(string $projectDir, array $targets, callable $operation): mixed
    {
        $this->acquire($projectDir);
        try {
            $this->begin($projectDir, $targets);
            $result = $operation();
            $this->commit();
            return $result;
        } catch (\Throwable $error) {
            $this->rollback($projectDir, $targets);
            throw $error;
        } finally {
            $this->release();
        }
    }

    private function acquire(string $projectDir): void
    {
        $dir = $projectDir . '/locks';
        @mkdir($dir, 0777, true);
        $path = $dir . '/project-mutation.lock';
        if (!@mkdir($path, 0777)) {
            throw new CpfException('PROJECT_MUTATION_LOCKED', 'Another CPF mutation is already running', 4);
        }
        $this->lockPath = $path;
        file_put_contents($path . '/owner.json', json_encode([
            'pid' => getmypid(), 'created_at' => date(DATE_ATOM)
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
    }

    private function begin(string $projectDir, array $targets): void
    {
        $base = $projectDir . '/transactions';
        @mkdir($base, 0777, true);
        $this->backupDir = $base . '/mutation-' . date('YmdHis') . '-' . bin2hex(random_bytes(4));
        if (!mkdir($this->backupDir, 0777, true)) {
            throw new CpfException('PROJECT_TRANSACTION_FAILED', 'Cannot create mutation backup', 5);
        }
        foreach (array_unique($targets) as $target) {
            $source = $projectDir . '/' . trim((string)$target, '/');
            $destination = $this->backupDir . '/' . trim((string)$target, '/');
            if (is_dir($source)) $this->copyDirectory($source, $destination);
            elseif (is_file($source)) { @mkdir(dirname($destination), 0777, true); copy($source, $destination); }
        }
    }

    private function commit(): void
    {
        if ($this->backupDir !== null) $this->removeDirectory($this->backupDir);
        $this->backupDir = null;
    }

    private function rollback(string $projectDir, array $targets): void
    {
        if ($this->backupDir === null) return;
        foreach (array_unique($targets) as $target) {
            $relative = trim((string)$target, '/');
            $current = $projectDir . '/' . $relative;
            $backup = $this->backupDir . '/' . $relative;
            if (is_dir($current)) $this->removeDirectory($current); elseif (is_file($current)) @unlink($current);
            if (is_dir($backup)) $this->copyDirectory($backup, $current);
            elseif (is_file($backup)) { @mkdir(dirname($current), 0777, true); copy($backup, $current); }
        }
        $this->removeDirectory($this->backupDir);
        $this->backupDir = null;
    }

    private function release(): void
    {
        if ($this->lockPath !== null) $this->removeDirectory($this->lockPath);
        $this->lockPath = null;
    }

    private function copyDirectory(string $source, string $destination): void
    {
        @mkdir($destination, 0777, true);
        foreach (array_diff(scandir($source) ?: [], ['.', '..']) as $item) {
            $from = $source . '/' . $item; $to = $destination . '/' . $item;
            if (is_link($from)) throw new CpfException('PROJECT_TRANSACTION_SYMLINK', 'Symlinks are not allowed', 5);
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
