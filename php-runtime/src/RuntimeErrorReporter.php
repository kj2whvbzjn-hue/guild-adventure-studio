<?php
declare(strict_types=1);

namespace GK\Export;

use Throwable;

final class RuntimeErrorReporter
{
    private const PUBLIC_MESSAGE = 'ゲームマスターデータが不正なため起動を停止しました。';

    public function __construct(
        private readonly ?string $logFile = null,
        private readonly string $publicError = 'GAME_MASTER_LOAD_FAILED',
    ) {
    }

    /** @return array<string,mixed> */
    public function publicPayload(Throwable $error, ?string $incidentId = null): array
    {
        $incidentId ??= $this->newIncidentId();
        return [
            'ok' => false,
            'error' => $this->publicError,
            'error_code' => $error instanceof ExportLoadException ? $error->errorCode : 'UNEXPECTED_ERROR',
            'message' => self::PUBLIC_MESSAGE,
            'incident_id' => $incidentId,
        ];
    }

    /** @return array<string,mixed> */
    public function adminPayload(Throwable $error, ?string $incidentId = null): array
    {
        $incidentId ??= $this->newIncidentId();
        $context = $error instanceof ExportLoadException ? $error->context : [];
        return [
            'timestamp' => gmdate('c'),
            'incident_id' => $incidentId,
            'error_code' => $error instanceof ExportLoadException ? $error->errorCode : 'UNEXPECTED_ERROR',
            'exception' => $error::class,
            'message' => $error->getMessage(),
            'context' => $this->sanitizeContext($context),
        ];
    }

    public function writeLog(Throwable $error, ?string $incidentId = null): string
    {
        $incidentId ??= $this->newIncidentId();
        if ($this->logFile === null || $this->logFile === '') {
            return $incidentId;
        }

        $directory = dirname($this->logFile);
        if (!is_dir($directory) && !@mkdir($directory, 0770, true) && !is_dir($directory)) {
            return $incidentId;
        }

        $line = json_encode(
            $this->adminPayload($error, $incidentId),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
        );
        if (is_string($line)) {
            @file_put_contents($this->logFile, $line . PHP_EOL, FILE_APPEND | LOCK_EX);
        }
        return $incidentId;
    }

    private function newIncidentId(): string
    {
        try {
            return gmdate('Ymd\THis\Z') . '-' . bin2hex(random_bytes(6));
        } catch (Throwable) {
            return gmdate('Ymd\THis\Z') . '-' . substr(hash('sha256', uniqid('', true)), 0, 12);
        }
    }

    /** @param array<string,mixed> $context
     *  @return array<string,mixed>
     */
    private function sanitizeContext(array $context): array
    {
        $result = [];
        foreach ($context as $key => $value) {
            $lower = strtolower((string)$key);
            if (preg_match('/password|passwd|secret|token|authorization|cookie|session/', $lower) === 1) {
                $result[(string)$key] = '[REDACTED]';
                continue;
            }
            if (is_string($value) && preg_match('/(?:^|_)(?:directory|absolute_path|root)(?:$|_)/', $lower) === 1) {
                $result[(string)$key] = '[REDACTED_PATH]';
                continue;
            }
            if (is_array($value)) {
                $result[(string)$key] = $this->sanitizeContext($value);
                continue;
            }
            if (is_scalar($value) || $value === null) {
                $result[(string)$key] = $value;
            } else {
                $result[(string)$key] = '[' . get_debug_type($value) . ']';
            }
        }
        return $result;
    }
}
