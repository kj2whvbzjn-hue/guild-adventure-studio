<?php
declare(strict_types=1);
$root = realpath($argv[1] ?? dirname(__DIR__, 2));
if ($root === false || !is_dir($root)) { fwrite(STDERR, "ROOT_NOT_FOUND\n"); exit(2); }
$files = [];
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
foreach ($it as $file) {
    $path = $file->getPathname();
    if (!$file->isFile() || substr($path, -4) !== '.php') continue;
    if (strpos($path, DIRECTORY_SEPARATOR . '.git' . DIRECTORY_SEPARATOR) !== false) continue;
    $files[] = $path;
}
sort($files, SORT_STRING);
$errors = [];
foreach ($files as $path) {
    try { token_get_all((string)file_get_contents($path), TOKEN_PARSE); }
    catch (ParseError $e) { $errors[] = substr($path, strlen($root) + 1) . ': ' . $e->getMessage(); }
}
if ($errors) { fwrite(STDERR, "PHP_SYNTAX_FAIL\n" . implode("\n", $errors) . "\n"); exit(1); }
echo 'PHP_SYNTAX_OK files=' . count($files) . PHP_EOL;
