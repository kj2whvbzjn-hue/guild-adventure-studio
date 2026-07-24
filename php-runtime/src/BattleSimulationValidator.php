<?php
declare(strict_types=1);
namespace GK\Export;

final class BattleSimulationValidator
{
    /** @return array<string,mixed> */
    public function run(array $case, ?int $battles=null, ?int $seed=null): array
    {
        $rules=$this->rules();$n=max(1,$battles??(int)($rules['batch_defaults']['battles']??1000));$base=$seed??(int)($rules['batch_defaults']['seed']??1);
        $sim=new BattleSimulator();$wins=['party'=>0,'enemy'=>0,'draw'=>0];$ticks=0;$actions=[];$skills=[];$first=null;
        for($i=0;$i<$n;$i++){ $r=$sim->simulate($case,$base+$i); if($i===0)$first=$r; $wins[$r['winner']]++;$ticks+=$r['ticks']; foreach($r['units'] as $u){$actions[$u['id']]=($actions[$u['id']]??0)+$u['actions'];$skills[$u['id']]=($skills[$u['id']]??0)+$u['skills'];}}
        $totalActions=array_sum($actions);$totalSkills=array_sum($skills);$findings=[];$t=$rules['thresholds']??[];
        $drawRate=$wins['draw']/$n;if($drawRate>=(float)($t['draw_rate_critical']??1))$findings[]=$this->f('critical','SIM_DRAW_RATE_CRITICAL',['rate'=>$drawRate]);elseif($drawRate>=(float)($t['draw_rate_warning']??1))$findings[]=$this->f('warning','SIM_DRAW_RATE_HIGH',['rate'=>$drawRate]);
        $partyRate=$wins['party']/$n;if($partyRate<(float)($t['side_win_rate_min_warning']??0)||$partyRate>(float)($t['side_win_rate_max_warning']??1))$findings[]=$this->f('warning','SIM_WIN_RATE_SKEW',['party_win_rate'=>$partyRate]);
        if($totalActions>0){$max=max($actions);$share=$max/$totalActions;if($share>(float)($t['action_share_warning']??1))$findings[]=$this->f('warning','SIM_ACTION_SHARE_SKEW',['share'=>$share]);}
        if($totalSkills>0){$max=max($skills);$share=$max/$totalSkills;if($share>(float)($t['skill_share_warning']??1))$findings[]=$this->f('warning','SIM_SKILL_SHARE_SKEW',['share'=>$share]);}
        $summary=['critical'=>0,'warning'=>0,'info'=>0];foreach($findings as $f)$summary[$f['severity']]++;
        return ['phase'=>'GVF-004','status'=>$summary['critical']?'FAIL':($summary['warning']?'WARN':'PASS'),'battles'=>$n,'seed'=>$base,'wins'=>$wins,'rates'=>['party'=>$partyRate,'enemy'=>$wins['enemy']/$n,'draw'=>$drawRate],'average_ticks'=>$ticks/$n,'actions'=>$actions,'skills'=>$skills,'summary'=>$summary,'findings'=>$findings,'first_battle'=>$first,'rules_version'=>(string)($rules['version']??'unknown')];
    }
    private function f(string $severity,string $code,array $extra):array{return array_merge(['severity'=>$severity,'code'=>$code],$extra);}
    private function rules():array{$p=dirname(__DIR__,2).'/schemas/battle-simulation-rules.json';$raw=file_get_contents($p);if($raw===false)throw new ExportLoadException('SIM_CONFIG_MISSING','Unable to read simulation rules.',['path'=>$p]);try{$v=json_decode($raw,true,512,JSON_THROW_ON_ERROR);}catch(\JsonException $e){throw new ExportLoadException('SIM_CONFIG_INVALID','Invalid simulation rules.',['path'=>$p],$e);}if(!is_array($v)||array_is_list($v))throw new ExportLoadException('SIM_CONFIG_INVALID','Simulation rules root must be an object.',['path'=>$p]);return$v;}
}
