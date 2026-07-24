<?php
declare(strict_types=1);

namespace GK\Export;

use RuntimeException;
use Throwable;

final class ExportLoadException extends RuntimeException
{
    /** @param array<string,mixed> $context */
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly array $context = [],
        ?Throwable $previous = null
    ) {
        parent::__construct($message, 0, $previous);
    }
}
