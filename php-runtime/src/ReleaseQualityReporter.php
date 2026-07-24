<?php
declare(strict_types=1);
namespace GK\Export;

final class ReleaseQualityReporter
{
    /** @return array<string,mixed> */
    public function generate(string $exportDirectory, ?array $battleCase = null, bool $strictRelease = false, ?int $battles = null, ?int $seed = null): array
    {
        $rules=$this->rules(); $checks=[]; $package=null;
        try {
            $package=(new ExportLoader(['1.0.0']))->load($exportDirectory);
            $checks['runtime']=['status'=>'PASS','score'=>100,'summary'=>['files'=>count($package->paths())],'findings'=>[]];
        } catch (\Throwable $e) {
            $checks['runtime']=['status'=>'FAIL','score'=>0,'summary'=>[],'findings'=>[['severity'=>'critical','code'=>$e instanceof ExportLoadException?$e->errorCode:'RUNTIME_ERROR','message'=>$e->getMessage()]]];
        }
        if($package instanceof ExportPackage){
            try{$r=(new GameValidationReporter())->generate($package,$strictRelease);$checks['integrity']=['status'=>'PASS','score'=>max(0,100-count($r['warnings']??[])*2),'summary'=>['references'=>$r['reference_checks']??0,'orphans'=>$r['orphan_count']??0],'findings'=>$r['warnings']??[]];}
            catch(\Throwable $e){$checks['integrity']=$this->failed($e);}
            try{$r=(new BalanceValidator())->validate($package);$checks['balance']=$r;}
            catch(\Throwable $e){$checks['balance']=$this->failed($e);}
            try{$r=(new ScenarioValidator())->validate($package,$strictRelease);$checks['scenario']=$r+['score'=>$this->findingScore($r['summary']??[], $rules)];}
            catch(\Throwable $e){$checks['scenario']=$this->failed($e);}
        } else {
            foreach(['integrity','balance','scenario'] as $name)$checks[$name]=['status'=>'BLOCKED','score'=>0,'summary'=>[],'findings'=>[]];
        }
        if($battleCase!==null){
            try{$r=(new BattleSimulationValidator())->run($battleCase,$battles,$seed);$checks['simulation']=$r+['score'=>$this->findingScore($r['summary']??[], $rules)];}
            catch(\Throwable $e){$checks['simulation']=$this->failed($e);}
        } else {
            $checks['simulation']=['status'=>'SKIPPED','score'=>(int)($rules['skipped_optional_score']??100),'summary'=>[],'findings'=>[['severity'=>'info','code'=>'SIMULATION_CASE_NOT_PROVIDED']]];
        }
        $required=$strictRelease?($rules['strict_required_checks']??[]):($rules['required_checks']??[]);
        $gate='PASS'; foreach($required as $name){$s=$checks[$name]['status']??'FAIL'; if(in_array($s,['FAIL','BLOCKED','SKIPPED'],true)){$gate='FAIL';break;} if($s==='WARN'&&$gate==='PASS')$gate='WARN';}
        $weights=$rules['weights']??[];$weighted=0;$total=0;foreach($checks as $name=>$check){$w=(int)($weights[$name]??0);$weighted+=$w*(int)($check['score']??0);$total+=$w;}
        $score=$total>0?(int)round($weighted/$total):0;
        return ['framework'=>'GVF','check'=>'GVF-005','status'=>$gate,'release_ready'=>$gate==='PASS','score'=>$score,'strict_release'=>$strictRelease,'generated_at'=>gmdate('c'),'checks'=>$checks,'rules_version'=>(string)($rules['version']??'unknown')];
    }
    private function failed(\Throwable $e):array{return ['status'=>'FAIL','score'=>0,'summary'=>[],'findings'=>[['severity'=>'critical','code'=>$e instanceof ExportLoadException?$e->errorCode:'QUALITY_CHECK_ERROR','message'=>$e->getMessage()]]];}
    private function findingScore(array $summary,array $rules):int{return max(0,100-(int)($summary['critical']??0)*10-(int)($summary['warning']??0)*(int)($rules['warning_penalty']??2));}
    private function rules():array{$p=dirname(__DIR__,2).'/schemas/release-quality-rules.json';$raw=file_get_contents($p);if($raw===false)throw new ExportLoadException('RELEASE_CONFIG_MISSING','Unable to read release quality rules.',['path'=>$p]);try{$v=json_decode($raw,true,512,JSON_THROW_ON_ERROR);}catch(\JsonException $e){throw new ExportLoadException('RELEASE_CONFIG_INVALID','Invalid release quality rules.',['path'=>$p],$e);}if(!is_array($v)||array_is_list($v))throw new ExportLoadException('RELEASE_CONFIG_INVALID','Release rules root must be object.');return$v;}
}
