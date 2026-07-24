<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use GK\Export\ExportLoader;
use GK\Export\RuntimeErrorReporter;

$reporter = new RuntimeErrorReporter(dirname(__DIR__) . '/var/log/export-errors.jsonl');

try {
    // 本番環境では、公開ディレクトリ外に置いたExportの絶対パスを指定する。
    $master = (new ExportLoader(['1.0.0']))->load(dirname(__DIR__, 2) . '/Export');

    $jobs = $master->data('master/jobs.json');
    $skills = $master->data('skill/skills.json');

    // ここからゲームサービスへ依存注入する。
    // $game = new GameApplication($jobs, $skills, ...);
} catch (Throwable $e) {
    $incidentId = $reporter->writeLog($e);
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(
        $reporter->publicPayload($e, $incidentId),
        JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE
    );
    exit;
}
