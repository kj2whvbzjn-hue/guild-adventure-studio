#!/usr/bin/env php
<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/bootstrap.php';
use GK\Export\{BalanceReportRenderer,BalanceValidator,ExportLoader,RuntimeErrorReporter};
$args=array_slice($argv,1);$strict=in_array('--strict',$args,true);$format=in_array('--html',$args,true)?'html':'json';$args=array_values(array_filter($args,fn($v)=>!in_array($v,['--strict','--html'],true)));$dir=$args[0]??dirname(__DIR__,2).'/Export';$out=$args[1]??null;$er=new RuntimeErrorReporter(getenv('GK_EXPORT_ERROR_LOG')?:null);
try{$pkg=(new ExportLoader(['1.0.0']))->load($dir);$report=(new BalanceValidator())->validate($pkg);$renderer=new BalanceReportRenderer();$body=$format==='html'?$renderer->html($report):$renderer->json($report);if($out){if(file_put_contents($out,$body)===false)throw new RuntimeException('Unable to write report.');}else echo $body;exit($strict&&$report['status']==='FAIL'?1:0);}catch(Throwable $e){$id=$er->writeLog($e);fwrite(STDERR,json_encode($er->adminPayload($e,$id),JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL);exit(2);}
