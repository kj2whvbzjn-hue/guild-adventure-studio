<?php
declare(strict_types=1);
namespace GK\Export;

final class BattleSimulator
{
    /** @return array<string,mixed> */
    public function simulate(array $case, int $seed, ?int $maxTicks = null): array
    {
        $rules=$this->rules(); $limit=$maxTicks ?? (int)($rules['max_ticks']??1000); $threshold=(int)($rules['gauge_threshold']??100);
        $rng=new DeterministicRandom($seed); $units=[];
        foreach(['party','enemy'] as $side) foreach(($case[$side]??[]) as $i=>$u) {
            if(!is_array($u)) continue;
            $id=(string)($u['id']??strtoupper($side).($i+1));
            $units[$id]=['id'=>$id,'side'=>$side,'hp'=>(int)($u['hp']??100),'max_hp'=>(int)($u['hp']??100),'agi'=>max(1,(int)($u['agi']??10)),'attack'=>max(1,(int)($u['attack']??10)),'defense'=>max(0,(int)($u['defense']??0)),'gauge'=>0,'skill_chance'=>max(0.0,min(1.0,(float)($u['skill_chance']??0.0))),'skill_power'=>max(1.0,(float)($u['skill_power']??1.5)),'actions'=>0,'skills'=>0];
        }
        $log=[];$winner=null;$tick=0;
        for($tick=1;$tick<=$limit;$tick++) {
            foreach($units as &$u) if($u['hp']>0) $u['gauge'] += $u['agi']; unset($u);
            $acted=true;
            while($acted) {
                $acted=false;
                $ready=[]; foreach($units as $id=>$u) if($u['hp']>0 && $u['gauge'] >= $threshold) $ready[$id]=$u;
                if($ready===[]) break;
                uasort($ready,fn($a,$b)=>($b['gauge']<=>$a['gauge']) ?: strcmp($a['id'],$b['id']));
                foreach(array_keys($ready) as $id) {
                    if(($units[$id]['hp']??0)<=0 || $units[$id]['gauge']<$threshold) continue;
                    $acted=true; $units[$id]['gauge']-=$threshold;
                    $targets=array_keys(array_filter($units,fn($v)=>$v['side']!==$units[$id]['side'] && $v['hp']>0));
                    if($targets===[]) break 2;
                    sort($targets); $targetId=$targets[$rng->range(0,count($targets)-1)];
                    $skill=$rng->float() < $units[$id]['skill_chance'];
                    $mult=$skill?$units[$id]['skill_power']:1.0;
                    $variance=$rng->range(90,110)/100;
                    $damage=max(1,(int)round(($units[$id]['attack']*$mult*$variance)-$units[$targetId]['defense']));
                    $units[$targetId]['hp']=max(0,$units[$targetId]['hp']-$damage);$units[$id]['actions']++;if($skill)$units[$id]['skills']++;
                    $log[]=['tick'=>$tick,'actor'=>$id,'target'=>$targetId,'skill'=>$skill,'damage'=>$damage,'target_hp'=>$units[$targetId]['hp']];
                    $aliveParty=count(array_filter($units,fn($v)=>$v['side']==='party'&&$v['hp']>0));
                    $aliveEnemy=count(array_filter($units,fn($v)=>$v['side']==='enemy'&&$v['hp']>0));
                    if($aliveParty===0||$aliveEnemy===0){$winner=$aliveParty>0?'party':'enemy';break 2;}
                }
            }
            if ($winner !== null) { break; }
        }
        $summaryUnits=[];foreach($units as $u)$summaryUnits[]=['id'=>$u['id'],'side'=>$u['side'],'hp'=>$u['hp'],'actions'=>$u['actions'],'skills'=>$u['skills']];
        return ['seed'=>$seed,'winner'=>$winner??'draw','ticks'=>min($tick,$limit),'max_ticks'=>$limit,'units'=>$summaryUnits,'log'=>$log];
    }
    private function rules():array { $p=dirname(__DIR__,2).'/schemas/battle-simulation-rules.json'; $v=json_decode((string)file_get_contents($p),true); return is_array($v)?$v:[]; }
}
