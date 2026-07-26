<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
require dirname(__DIR__, 2) . '/php-runtime/bootstrap.php';

use GK\CPF\Core\CpfNodeManager;
use GK\CPF\Approval\CpfApprovalManager;
use GK\CPF\Export\CpfDemoRuntimeExporter;
use GK\Export\ExportLoader;

function failRuntimeExport(string $m): never { fwrite(STDERR,"[FAIL] $m\n"); exit(1); }
function rmRuntimeExport(string $d): void { if(!is_dir($d))return; foreach(array_diff(scandir($d)?:[],['.','..']) as $i){$p="$d/$i";is_dir($p)&&!is_link($p)?rmRuntimeExport($p):@unlink($p);}@rmdir($d); }
$root=sys_get_temp_dir().'/cpf-demo-runtime-'.bin2hex(random_bytes(4)); $project="$root/project"; $output="$root/Export"; mkdir($project,0777,true);
$n=new CpfNodeManager(); $a=new CpfApprovalManager();
try {
  foreach([
    ['CH_DEMO','chapter',['title'=>'第一章']],
    ['SEC_DEMO','section',['title'=>'出発']],
    ['SCN_DEMO','scene',['title'=>'ギルド前','text'=>'冒険が始まる。']],
    ['EV_DEMO','event',['title'=>'受付イベント','trigger'=>'demo_start']],
  ] as [$id,$type,$payload]) { $n->create($project,$id,$type,$payload); $a->approve($project,$id,'test'); }
  $r=(new CpfDemoRuntimeExporter())->export($project,dirname(__DIR__,2).'/Export',$output,'0.1.0-demo-test');
  if(($r['ok']??false)!==true) failRuntimeExport('export result');
  $pkg=(new ExportLoader())->load($output);
  if(count($pkg->data('scenario/chapters.json'))!==1) failRuntimeExport('chapter count');
  if(($pkg->data('scenario/scenes.json')[0]['text']??'')!=='冒険が始まる。') failRuntimeExport('scene text');
  if(($pkg->data('event/events.json')[0]['trigger']??'')!=='demo_start') failRuntimeExport('event payload');
  echo "[PASS] approved CPF demo nodes exported to Runtime Export\n";
  echo "[PASS] generated manifest and hashes accepted by php-runtime ExportLoader\n";
} finally { rmRuntimeExport($root); }
