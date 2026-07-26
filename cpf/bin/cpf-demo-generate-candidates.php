#!/usr/bin/env php
<?php
declare(strict_types=1);
require __DIR__ . '/_wrapper.php';
passthru(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/cpf.php') . ' demo:generate-candidates ' . implode(' ', array_map('escapeshellarg', array_slice($argv, 1))), $code);
exit($code);
