<?php
declare(strict_types=1);

namespace GK\Export;

final class AtomicExportUpdater
{
    public function __construct(private readonly ExportLoader $loader = new ExportLoader()) {}

    public function update(string $candidateDirectory, string $targetDirectory): ExportPackage
    {
        $candidate = $this->realDirectory($candidateDirectory, 'UPDATE_CANDIDATE_NOT_FOUND');
        $target = rtrim($targetDirectory, DIRECTORY_SEPARATOR);
        if ($target === '') {
            throw new ExportLoadException('UPDATE_TARGET_INVALID', 'Target Export directory is empty.');
        }

        $parent = dirname($target);
        if (!is_dir($parent) || !is_writable($parent)) {
            throw new ExportLoadException('UPDATE_TARGET_PARENT_INVALID', 'Target parent directory must exist and be writable.', ['directory' => $parent]);
        }
        if (is_link($target)) {
            throw new ExportLoadException('SYMLINK_FORBIDDEN', 'Target Export directory must not be a symbolic link.', ['directory' => $target]);
        }
        if (realpath($target) !== false && realpath($target) === $candidate) {
            throw new ExportLoadException('UPDATE_SOURCE_EQUALS_TARGET', 'Candidate and target Export directories must differ.');
        }

        // Validate before copying so a broken candidate never affects the live Export.
        $this->loader->load($candidate);

        $token = bin2hex(random_bytes(8));
        $base = basename($target);
        $staging = $parent . DIRECTORY_SEPARATOR . '.' . $base . '.staging-' . $token;
        $previous = $parent . DIRECTORY_SEPARATOR . '.' . $base . '.previous-' . $token;
        $lockPath = $parent . DIRECTORY_SEPARATOR . '.' . $base . '.update.lock';
        $lock = @fopen($lockPath, 'c');
        if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
            if (is_resource($lock)) { fclose($lock); }
            throw new ExportLoadException('UPDATE_LOCKED', 'Another Export update is already running.');
        }

        try {
            $this->copyTree($candidate, $staging);
            $package = $this->loader->load($staging);

            $hadTarget = is_dir($target);
            if (file_exists($target) && !$hadTarget) {
                throw new ExportLoadException('UPDATE_TARGET_INVALID', 'Target exists but is not a directory.', ['directory' => $target]);
            }

            if ($hadTarget) { (new ExportRollbackManager($this->loader))->backup($target, $target); }

            if ($hadTarget && !@rename($target, $previous)) {
                throw new ExportLoadException('UPDATE_SWITCH_FAILED', 'Could not move the current Export out of the live path.');
            }

            if (!@rename($staging, $target)) {
                if ($hadTarget && is_dir($previous)) { @rename($previous, $target); }
                throw new ExportLoadException('UPDATE_SWITCH_FAILED', 'Could not switch the validated Export into the live path.');
            }

            if ($hadTarget && is_dir($previous)) {
                $this->removeTree($previous);
            }
            return $package;
        } catch (ExportLoadException $e) {
            if (is_dir($staging)) { $this->removeTree($staging); }
            throw $e;
        } catch (\Throwable $e) {
            if (is_dir($staging)) { $this->removeTree($staging); }
            throw new ExportLoadException('UPDATE_FAILED', 'Atomic Export update failed.', [], $e);
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
            @unlink($lockPath);
        }
    }

    private function realDirectory(string $directory, string $errorCode): string
    {
        if ($directory === '' || is_link($directory)) {
            throw new ExportLoadException($directory === '' ? $errorCode : 'SYMLINK_FORBIDDEN', 'Candidate Export directory is invalid.');
        }
        $real = realpath($directory);
        if ($real === false || !is_dir($real)) {
            throw new ExportLoadException($errorCode, 'Candidate Export directory was not found.', ['directory' => $directory]);
        }
        return $real;
    }

    private function copyTree(string $source, string $destination): void
    {
        if (!@mkdir($destination, 0700, false)) {
            throw new ExportLoadException('UPDATE_STAGING_CREATE_FAILED', 'Could not create the staging directory.');
        }
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($source, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ($iterator as $item) {
            $relative = $iterator->getSubPathName();
            if ($item->isLink()) {
                throw new ExportLoadException('SYMLINK_FORBIDDEN', "Symbolic links are forbidden in update candidate: {$relative}", ['path' => $relative]);
            }
            $to = $destination . DIRECTORY_SEPARATOR . $relative;
            if ($item->isDir()) {
                if (!@mkdir($to, 0700, false) && !is_dir($to)) {
                    throw new ExportLoadException('UPDATE_COPY_FAILED', "Could not create staging directory: {$relative}", ['path' => $relative]);
                }
            } elseif ($item->isFile()) {
                if (!@copy($item->getPathname(), $to)) {
                    throw new ExportLoadException('UPDATE_COPY_FAILED', "Could not copy candidate file: {$relative}", ['path' => $relative]);
                }
            } else {
                throw new ExportLoadException('UNSUPPORTED_FILE_TYPE', "Unsupported candidate entry: {$relative}", ['path' => $relative]);
            }
        }
    }

    private function removeTree(string $directory): void
    {
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($iterator as $item) {
            $path = $item->getPathname();
            if ($item->isDir() && !$item->isLink()) { @rmdir($path); }
            else { @unlink($path); }
        }
        @rmdir($directory);
    }
}
