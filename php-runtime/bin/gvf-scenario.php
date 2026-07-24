#!/usr/bin/env php
<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/bootstrap.php';
use GK\Export\ExportLoader; use GK\Export\ScenarioValidator; use GK\Export\ExportLoadException;
$source=$argv[1]??dirname(__DIR__,2).'/Export';$strict=in_array('--strict-milestones',$argv,true);
try{$pkg=(new ExportLoader(['1.0.0']))->load($source);$r=(new ScenarioValidator())->validate($pkg,$strict);echo json_encode($r,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL;exit($r['status']==='FAIL'?1:0);}catch(ExportLoadException $e){fwrite(STDERR,json_encode(['error_code'=>$e->errorCode,'message'=>$e->getMessage()],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL);exit(2);}catch(Throwable $e){fwrite(STDERR,$e->getMessage().PHP_EOL);exit(2);}
