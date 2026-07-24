#!/usr/bin/env php
<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/bootstrap.php';
use GK\Export\{ReleaseQualityReporter,ReleaseQualityRenderer};
$args=array_slice($argv,1);$html=in_array('--html',$args,true);$strict=in_array('--strict-release',$args,true);$args=array_values(array_filter($args,fn($v)=>!in_array($v,['--html','--strict-release'],true)));$export=$args[0]??dirname(__DIR__,2).'/Export';$out=$args[1]??null;$casePath=$args[2]??null;$battles=isset($args[3])?(int)$args[3]:null;$seed=isset($args[4])?(int)$args[4]:null;
try{$case=null;if($casePath!==null){$case=json_decode((string)file_get_contents($casePath),true,512,JSON_THROW_ON_ERROR);if(!is_array($case))throw new RuntimeException('Battle case root must be object.');}$r=(new ReleaseQualityReporter())->generate($export,$case,$strict,$battles,$seed);$renderer=new ReleaseQualityRenderer();$body=$html?$renderer->html($r):$renderer->json($r);if($out){if(file_put_contents($out,$body)===false)throw new RuntimeException('Unable to write report.');}else echo $body;exit($r['release_ready']?0:1);}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(2);}
