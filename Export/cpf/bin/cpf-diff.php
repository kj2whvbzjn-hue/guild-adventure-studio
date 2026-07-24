#!/usr/bin/env php
<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
use GK\CPF\Diff\CpfDiffService;
if ($argc < 3) { fwrite(STDERR, "Usage: cpf-diff.php before.json after.json\n"); exit(1); }
$before = json_decode((string)file_get_contents($argv[1]), true);
$after = json_decode((string)file_get_contents($argv[2]), true);
if (!is_array($before) || !is_array($after)) { fwrite(STDERR, "Invalid JSON\n"); exit(1); }
echo json_encode((new CpfDiffService())->diff($before, $after), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
