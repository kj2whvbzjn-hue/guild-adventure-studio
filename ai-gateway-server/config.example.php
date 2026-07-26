<?php
declare(strict_types=1);
return [
    'token' => 'CHANGE_ME_TO_A_LONG_RANDOM_TOKEN',
    'allowed_origins' => ['http://127.0.0.1:8765', 'http://localhost:8765'],
    'root' => dirname(__DIR__),
    'snapshot_file' => __DIR__ . '/runtime/current-context.json',
];
