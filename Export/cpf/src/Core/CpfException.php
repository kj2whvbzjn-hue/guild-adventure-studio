<?php
declare(strict_types=1); namespace GK\CPF\Core;
final class CpfException extends \RuntimeException { public function __construct(public readonly string $errorCode,string $message,public readonly int $exitCode=1){parent::__construct($message);} }