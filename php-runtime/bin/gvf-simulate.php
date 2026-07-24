#!/usr/bin/env php
<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/bootstrap.php';
use GK\Export\BattleSimulationValidator;
$input=$argv[1]??'';$battles=isset($argv[2])?(int)$argv[2]:null;$seed=isset($argv[3])?(int)$argv[3]:null;
if($input===''||!is_file($input)){fwrite(STDERR,"Usage: php gvf-simulate.php battle-case.json [battles] [seed]\n");exit(2);}try{$case=json_decode((string)file_get_contents($input),true,512,JSON_THROW_ON_ERROR);if(!is_array($case))throw new RuntimeException('case root must be object');$r=(new BattleSimulationValidator())->run($case,$battles,$seed);echo json_encode($r,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)."\n";exit($r['status']==='FAIL'?1:0);}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(2);}
