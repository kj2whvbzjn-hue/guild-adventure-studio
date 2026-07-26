<?php
require dirname(__DIR__) . '/bootstrap.php';
use GK\CPF\Core\{CpfProjectMutation, CpfException};
$dir=sys_get_temp_dir().'/cpf-mutation-'.bin2hex(random_bytes(4));
mkdir($dir.'/nodes',0777,true); mkdir($dir.'/history',0777,true);
file_put_contents($dir.'/nodes/A.json',"{\"v\":1}\n");
$m=new CpfProjectMutation();
try { $m->execute($dir,['nodes','history'],function()use($dir){file_put_contents($dir.'/nodes/A.json',"{\"v\":2}\n");file_put_contents($dir.'/history/history.json',"[]\n");throw new RuntimeException('injected');}); } catch(RuntimeException $e) {}
if(trim(file_get_contents($dir.'/nodes/A.json'))!=='{"v":1}' || file_exists($dir.'/history/history.json')){fwrite(STDERR,"rollback failed\n");exit(1);} 
mkdir($dir.'/locks/project-mutation.lock',0777,true);
try{$m->execute($dir,['nodes'],fn()=>null);fwrite(STDERR,"lock failed\n");exit(1);}catch(CpfException $e){if($e->getMessage()!=='Another CPF mutation is already running')throw $e;}
echo "[PASS] mutation rollback\n[PASS] mutation lock\n";
