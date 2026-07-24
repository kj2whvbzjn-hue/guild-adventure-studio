<?php
declare(strict_types=1);
namespace GK\Export;
final class ReleaseQualityRenderer
{
    public function json(array $report):string{return json_encode($report,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_INVALID_UTF8_SUBSTITUTE)."\n";}
    public function html(array $r):string{$rows='';foreach($r['checks'] as $name=>$c){$rows.='<tr><td>'.htmlspecialchars(strtoupper($name)).'</td><td>'.htmlspecialchars((string)$c['status']).'</td><td>'.(int)$c['score'].'</td></tr>';}$ready=$r['release_ready']?'YES':'NO';return '<!doctype html><html><head><meta charset="utf-8"><title>GVF-005 Release Quality Report</title><style>body{font-family:sans-serif;max-width:900px;margin:40px auto;padding:0 20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:10px;text-align:left}.score{font-size:42px;font-weight:bold}</style></head><body><h1>GVF-005 Release Quality Report</h1><p class="score">'.(int)$r['score'].'/100</p><p>Release Ready: <strong>'.$ready.'</strong> / Status: <strong>'.htmlspecialchars((string)$r['status']).'</strong></p><table><thead><tr><th>Check</th><th>Status</th><th>Score</th></tr></thead><tbody>'.$rows.'</tbody></table></body></html>';}
}
