<?php
declare(strict_types=1);
namespace GK\Export;

final class ScenarioValidator
{
    /** @return array{phase:string,status:string,summary:array<string,int>,findings:list<array<string,mixed>>,rules_version:string} */
    public function validate(ExportPackage $package, bool $strictMilestones = false): array
    {
        $rules=$this->readRules(); $docs=$package->allDocuments(); $findings=[];
        foreach(($rules['sequence_rules']??[]) as $r)$this->sequence($docs,$r,$findings);
        foreach(($rules['parent_order_rules']??[]) as $r)$this->parentOrder($docs,$r,$findings);
        foreach(($rules['terminal_marker_rules']??[]) as $r)$this->terminalMarker($docs,$r,$findings);
        if(is_array($rules['flag_flow']??null))$this->flagFlow($docs,$rules['flag_flow'],$findings);
        $this->milestones($docs,$rules['milestones']??[],$findings,$strictMilestones);
        $summary=['critical'=>0,'warning'=>0,'info'=>0]; foreach($findings as $f)$summary[$f['severity']]++;
        return ['phase'=>'GVF-003','status'=>$summary['critical']>0?'FAIL':($summary['warning']>0?'WARN':'PASS'),'summary'=>$summary,'findings'=>$findings,'rules_version'=>(string)($rules['version']??'unknown')];
    }
    private function sequence(array $docs,mixed $r,array &$out):void
    {
        if(!is_array($r)||!is_string($r['path']??null))return; $groups=[];
        foreach($this->records($docs,$r['path']) as $i=>$rec){$g=(string)($rec[$r['group_field']??'']??'__all__');$groups[$g][]=[$i,$rec];}
        foreach($groups as $g=>$items){$prev=null;$seen=[];foreach($items as [$i,$rec]){$v=$this->firstNumeric($rec,$r['order_fields']??[]);if($v===null)continue;if(isset($seen[(string)$v]))$this->add($out,$r,(string)($r['code']??'SCENARIO_DUPLICATE_ORDER'),$r['path'],$i,$rec,['group'=>$g,'order'=>$v,'reason'=>'duplicate']);$seen[(string)$v]=true;if($prev!==null&&$v<$prev)$this->add($out,$r,(string)($r['code']??'SCENARIO_ORDER'),$r['path'],$i,$rec,['group'=>$g,'order'=>$v,'previous'=>$prev,'reason'=>'decreasing']);$prev=$v;}}
    }
    private function parentOrder(array $docs,mixed $r,array &$out):void
    {
        if(!is_array($r)||!is_string($r['child_path']??null)||!is_string($r['parent_path']??null)||!is_string($r['parent_field']??null))return;$parents=[];foreach($this->records($docs,$r['parent_path']) as $p){if(is_string($p['id']??null))$parents[$p['id']]=$p;}
        foreach($this->records($docs,$r['child_path']) as $i=>$c){$pid=$c[$r['parent_field']]??null;if(!is_string($pid)||!isset($parents[$pid]))continue;$cv=$this->firstNumeric($c,$r['child_order_fields']??[]);$pv=$this->firstNumeric($parents[$pid],$r['parent_order_fields']??[]);if($cv!==null&&$pv!==null&&$cv!==$pv)$this->add($out,$r,'SCENARIO_PARENT_ORDER_MISMATCH',$r['child_path'],$i,$c,['parent_id'=>$pid,'child_parent_order'=>$cv,'actual_parent_order'=>$pv]);}
    }
    private function terminalMarker(array $docs,mixed $r,array &$out):void
    {
        if(!is_array($r)||!is_string($r['path']??null)||!is_string($r['marker_field']??null))return;$groups=[];foreach($this->records($docs,$r['path']) as $i=>$rec){$g=(string)($rec[$r['group_field']??'']??'__all__');$v=$this->firstNumeric($rec,$r['order_fields']??[]);if($v!==null)$groups[$g][]=[$i,$rec,$v];}
        foreach($groups as $g=>$items){$max=max(array_column($items,2));foreach($items as [$i,$rec,$v])if(($rec[$r['marker_field']]??null)===($r['marker_value']??true)&&$v!==$max)$this->add($out,$r,(string)($r['code']??'SCENARIO_TERMINAL_MARKER'),$r['path'],$i,$rec,['group'=>$g,'order'=>$v,'terminal_order'=>$max]);}
    }
    private function flagFlow(array $docs,array $r,array &$out):void
    {
        $events=$this->records($docs,(string)($r['event_path']??''));usort($events,fn($a,$b)=>($this->firstNumeric($a,$r['order_fields']??[])??PHP_INT_MAX)<=>($this->firstNumeric($b,$r['order_fields']??[])??PHP_INT_MAX));$set=[];
        foreach($events as $i=>$e){foreach($this->valuesFromFields($e,$r['require_fields']??[]) as $flag)if(!isset($set[$flag]))$this->add($out,$r,'SCENARIO_FLAG_REQUIRED_BEFORE_SET',(string)$r['event_path'],$i,$e,['flag_id'=>$flag]);foreach($this->valuesFromFields($e,$r['set_fields']??[]) as $flag)$set[$flag]=true;}
    }
    private function milestones(array $docs,mixed $rules,array &$out,bool $strict):void
    {
        if(!is_array($rules)||$this->records($docs,'scenario/chapters.json')===[])return;$all=[];foreach(['scenario/chapters.json','scenario/sections.json','scenario/scenes.json','quest/main_quests.json','event/events.json'] as $path)foreach($this->records($docs,$path) as $i=>$r)if(is_string($r['milestone_key']??null))$all[$r['milestone_key']][]=[$path,$i,$r];
        foreach($rules as $rule){if(!is_array($rule)||!is_string($rule['key']??null))continue;$matches=$all[$rule['key']]??[];$sev=$strict?'critical':($rule['severity']??'warning');if($matches===[]){$this->add($out,['severity'=>$sev],'SCENARIO_MILESTONE_MISSING','scenario',0,[],['milestone_key'=>$rule['key'],'expected_chapter'=>$rule['expected_chapter']??null,'description'=>$rule['description']??'']);continue;}foreach($matches as [$path,$i,$rec]){$ch=$rec['chapter_no']??$rec['chapter_order']??null;if(is_numeric($ch)&&isset($rule['expected_chapter'])&&(int)$ch!==(int)$rule['expected_chapter'])$this->add($out,['severity'=>$sev],'SCENARIO_MILESTONE_CHAPTER_MISMATCH',$path,$i,$rec,['milestone_key'=>$rule['key'],'actual_chapter'=>(int)$ch,'expected_chapter'=>(int)$rule['expected_chapter']]);}}
    }
    private function valuesFromFields(array $r,mixed $fields):array{$out=[];if(!is_array($fields))return$out;foreach($fields as $f){if(!is_string($f)||!array_key_exists($f,$r))continue;$v=$r[$f];if(is_string($v)&&$v!=='')$out[]=$v;elseif(is_array($v))foreach($v as $x)if(is_string($x)&&$x!=='')$out[]=$x;}return$out;}
    private function firstNumeric(array $r,mixed $fields):int|float|null{if(!is_array($fields))return null;foreach($fields as $f)if(is_string($f)&&isset($r[$f])&&is_numeric($r[$f]))return $r[$f]+0;return null;}
    private function records(array $docs,string $path):array{$d=$docs[$path]['data']??[];return is_array($d)&&array_is_list($d)?$d:[];}
    private function add(array &$out,array $r,string $code,string $path,int $index,array $record,array $extra=[]):void{$sev=in_array($r['severity']??'', ['critical','warning','info'],true)?$r['severity']:'warning';$out[]=array_merge(['severity'=>$sev,'code'=>$code,'path'=>$path,'index'=>$index,'record_id'=>is_string($record['id']??null)?$record['id']:null],$extra);}
    private function readRules():array{$p=dirname(__DIR__,2).'/schemas/scenario-validation-rules.json';$raw=file_get_contents($p);if($raw===false)throw new ExportLoadException('SCENARIO_CONFIG_MISSING','Unable to read scenario rules.',['path'=>$p]);try{$v=json_decode($raw,true,512,JSON_THROW_ON_ERROR);}catch(\JsonException $e){throw new ExportLoadException('SCENARIO_CONFIG_INVALID','Invalid scenario rules JSON.',['path'=>$p],$e);}if(!is_array($v)||array_is_list($v))throw new ExportLoadException('SCENARIO_CONFIG_INVALID','Scenario rules root must be an object.',['path'=>$p]);return$v;}
}
