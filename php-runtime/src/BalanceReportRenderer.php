<?php
declare(strict_types=1);
namespace GK\Export;
final class BalanceReportRenderer
{
    public function json(array $report): string { return json_encode($report, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR).PHP_EOL; }
    public function html(array $r): string {
        $e=static fn(mixed $v):string=>htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
        $rows=''; foreach($r['findings'] as $f){$rows.='<tr><td>'.$e($f['severity']).'</td><td>'.$e($f['code']).'</td><td>'.$e($f['path']).'</td><td>'.$e($f['record_id']??$f['index']).'</td><td>'.$e($f['field']).'</td><td>'.$e(json_encode($f['actual'],JSON_UNESCAPED_UNICODE)).'</td></tr>';}
        return '<!doctype html><html lang="ja"><meta charset="utf-8"><title>GVF-002 Balance Report</title><body><h1>GVF-002 Balance Report</h1><p>Status: '.$e($r['status']).' / Score: '.$e($r['score']).'/100</p><p>Critical: '.$e($r['summary']['critical']).' Warning: '.$e($r['summary']['warning']).' Info: '.$e($r['summary']['info']).'</p><table border="1"><thead><tr><th>Severity</th><th>Code</th><th>Path</th><th>Record</th><th>Field</th><th>Actual</th></tr></thead><tbody>'.$rows.'</tbody></table></body></html>';
    }
}
