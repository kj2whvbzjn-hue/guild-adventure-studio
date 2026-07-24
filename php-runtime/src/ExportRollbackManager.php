<?php
declare(strict_types=1);
namespace GK\Export;

final class ExportRollbackManager
{
    public function __construct(private readonly ExportLoader $loader = new ExportLoader()) {}

    public function backup(string $sourceDirectory, string $targetDirectory): string
    {
        $source = $this->realDirectory($sourceDirectory, 'ROLLBACK_SOURCE_NOT_FOUND');
        $this->loader->load($source);
        $root = $this->backupRoot($targetDirectory);
        if (!is_dir($root) && !@mkdir($root, 0700, true)) {
            throw new ExportLoadException('ROLLBACK_BACKUP_CREATE_FAILED', 'Could not create rollback backup root.', ['directory' => $root]);
        }
        $name = gmdate('Ymd\THis\Z') . '-' . bin2hex(random_bytes(4));
        $destination = $root . DIRECTORY_SEPARATOR . $name;
        $this->copyTree($source, $destination);
        $this->loader->load($destination);
        return $destination;
    }

    public function restore(string $backupDirectory, string $targetDirectory): ExportPackage
    {
        $backup = $this->realDirectory($backupDirectory, 'ROLLBACK_BACKUP_NOT_FOUND');
        $this->loader->load($backup);
        $target = rtrim($targetDirectory, DIRECTORY_SEPARATOR);
        $parent = dirname($target);
        if ($target === '' || !is_dir($parent) || !is_writable($parent) || is_link($target)) {
            throw new ExportLoadException('ROLLBACK_TARGET_INVALID', 'Rollback target is invalid.', ['directory' => $target]);
        }
        $token = bin2hex(random_bytes(8));
        $base = basename($target);
        $staging = $parent . DIRECTORY_SEPARATOR . '.' . $base . '.rollback-staging-' . $token;
        $previous = $parent . DIRECTORY_SEPARATOR . '.' . $base . '.rollback-previous-' . $token;
        $lockPath = $parent . DIRECTORY_SEPARATOR . '.' . $base . '.update.lock';
        $lock = @fopen($lockPath, 'c');
        if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
            if (is_resource($lock)) fclose($lock);
            throw new ExportLoadException('UPDATE_LOCKED', 'Another Export update or rollback is already running.');
        }
        try {
            $this->copyTree($backup, $staging);
            $package = $this->loader->load($staging);
            $hadTarget = is_dir($target);
            if (file_exists($target) && !$hadTarget) throw new ExportLoadException('ROLLBACK_TARGET_INVALID', 'Target exists but is not a directory.');
            if ($hadTarget && !@rename($target, $previous)) throw new ExportLoadException('ROLLBACK_SWITCH_FAILED', 'Could not move current Export out of live path.');
            if (!@rename($staging, $target)) {
                if ($hadTarget && is_dir($previous)) @rename($previous, $target);
                throw new ExportLoadException('ROLLBACK_SWITCH_FAILED', 'Could not switch rollback Export into live path.');
            }
            if ($hadTarget && is_dir($previous)) {
                try { $this->backup($previous, $target); } finally { $this->removeTree($previous); }
            }
            return $package;
        } catch (ExportLoadException $e) {
            if (is_dir($staging)) $this->removeTree($staging);
            throw $e;
        } catch (\Throwable $e) {
            if (is_dir($staging)) $this->removeTree($staging);
            throw new ExportLoadException('ROLLBACK_FAILED', 'Export rollback failed.', [], $e);
        } finally {
            flock($lock, LOCK_UN); fclose($lock); @unlink($lockPath);
        }
    }

    private function backupRoot(string $targetDirectory): string
    {
        $target = rtrim($targetDirectory, DIRECTORY_SEPARATOR);
        return dirname($target) . DIRECTORY_SEPARATOR . '.' . basename($target) . '.rollback';
    }
    private function realDirectory(string $directory, string $code): string
    {
        if ($directory === '' || is_link($directory)) throw new ExportLoadException($directory === '' ? $code : 'SYMLINK_FORBIDDEN', 'Rollback directory is invalid.');
        $real = realpath($directory);
        if ($real === false || !is_dir($real)) throw new ExportLoadException($code, 'Rollback directory was not found.', ['directory' => $directory]);
        return $real;
    }
    private function copyTree(string $source, string $destination): void
    {
        if (!@mkdir($destination, 0700, false)) throw new ExportLoadException('ROLLBACK_COPY_FAILED', 'Could not create rollback directory.');
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($source, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::SELF_FIRST);
        foreach ($it as $item) {
            $rel = $it->getSubPathName();
            if ($item->isLink()) throw new ExportLoadException('SYMLINK_FORBIDDEN', 'Symbolic links are forbidden in rollback data.', ['path' => $rel]);
            $to = $destination . DIRECTORY_SEPARATOR . $rel;
            if ($item->isDir()) { if (!@mkdir($to, 0700, false) && !is_dir($to)) throw new ExportLoadException('ROLLBACK_COPY_FAILED', 'Could not create rollback subdirectory.', ['path'=>$rel]); }
            elseif ($item->isFile()) { if (!@copy($item->getPathname(), $to)) throw new ExportLoadException('ROLLBACK_COPY_FAILED', 'Could not copy rollback file.', ['path'=>$rel]); }
            else throw new ExportLoadException('UNSUPPORTED_FILE_TYPE', 'Unsupported rollback entry.', ['path'=>$rel]);
        }
    }
    private function removeTree(string $directory): void
    {
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($it as $item) { $p=$item->getPathname(); ($item->isDir()&&!$item->isLink())?@rmdir($p):@unlink($p); }
        @rmdir($directory);
    }
}
