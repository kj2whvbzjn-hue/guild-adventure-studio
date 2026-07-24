<?php
declare(strict_types=1);
namespace GK\Export;

final class BalanceValidator
{
    /** @return array{phase:string,status:string,score:int,summary:array<string,int>,findings:list<array<string,mixed>>,rules_version:string} */
    public function validate(ExportPackage $package): array
    {
        $rules = $this->readRules();
        $docs = $package->allDocuments();
        $findings = [];
        foreach (($rules['numeric_ranges'] ?? []) as $rule) $this->numericRanges($docs, $rule, $findings);
        foreach (($rules['record_sums'] ?? []) as $rule) $this->recordSums($docs, $rule, $findings);
        foreach (($rules['nested_unique'] ?? []) as $rule) $this->nestedUnique($docs, $rule, $findings);
        foreach (($rules['monotonic_sequences'] ?? []) as $rule) $this->monotonic($docs, $rule, $findings);
        foreach (($rules['comparisons'] ?? []) as $rule) $this->comparisons($docs, $rule, $findings);
        $summary = ['critical'=>0,'warning'=>0,'info'=>0];
        foreach ($findings as $f) $summary[$f['severity']]++;
        $scoreCfg = $rules['score'] ?? [];
        $score = max(0, 100 - $summary['critical'] * (int)($scoreCfg['critical_penalty'] ?? 10) - $summary['warning'] * (int)($scoreCfg['warning_penalty'] ?? 2));
        return ['phase'=>'GVF-002','status'=>$summary['critical']>0?'FAIL':($summary['warning']>0?'WARN':'PASS'),'score'=>$score,'summary'=>$summary,'findings'=>$findings,'rules_version'=>(string)($rules['version'] ?? 'unknown')];
    }

    private function numericRanges(array $docs, mixed $rule, array &$out): void
    {
        if (!is_array($rule) || !is_string($rule['path']??null) || !is_array($rule['fields']??null)) return;
        foreach ($this->records($docs,$rule['path']) as $i=>$r) foreach ($rule['fields'] as $field=>$range) {
            if (!array_key_exists($field,$r)) continue;
            $v=$r[$field];
            if (!is_int($v)&&!is_float($v)) { $this->add($out,$rule,'BALANCE_NUMERIC_TYPE',$rule['path'],$i,$r,$field,$v); continue; }
            if ((isset($range['min'])&&$v<$range['min'])||(isset($range['max'])&&$v>$range['max'])) $this->add($out,$rule,'BALANCE_RANGE',$rule['path'],$i,$r,$field,$v,['expected'=>$range]);
        }
    }
    private function recordSums(array $docs, mixed $rule, array &$out): void
    {
        if (!is_array($rule)||!is_string($rule['path']??null)) return;
        foreach ($this->records($docs,$rule['path']) as $i=>$r) {
            $items=$r[$rule['list_field']??'']??null; if ($items===null) continue;
            if (!is_array($items)) { $this->add($out,$rule,'BALANCE_LIST_TYPE',$rule['path'],$i,$r,(string)$rule['list_field'],$items); continue; }
            if ($items===[] && ($rule['allow_empty']??false)===true) continue;
            $sum=0.0; foreach($items as $j=>$item){$v=is_array($item)?($item[$rule['value_field']??'']??null):null; if(!is_int($v)&&!is_float($v)){$this->add($out,$rule,'BALANCE_RATE_TYPE',$rule['path'],$i,$r,(string)$rule['value_field'],$v,['entry_index'=>$j]);continue;} $sum+=(float)$v;}
            $eps=(float)($rule['epsilon']??0); if($sum<(float)($rule['min']??0)-$eps||$sum>(float)($rule['max']??1)+$eps)$this->add($out,$rule,'BALANCE_SUM',$rule['path'],$i,$r,(string)$rule['list_field'],$sum,['expected_min'=>$rule['min']??0,'expected_max'=>$rule['max']??1]);
        }
    }
    private function nestedUnique(array $docs,mixed $rule,array &$out):void
    {
        if(!is_array($rule)||!is_string($rule['path']??null))return;
        foreach($this->records($docs,$rule['path']) as $i=>$r){$items=$r[$rule['list_field']??'']??null;if(!is_array($items))continue;$seen=[];foreach($items as $j=>$item){$key=is_array($item)?($item[$rule['key_field']??'']??null):null;if(!is_string($key)||$key==='')continue;if(isset($seen[$key]))$this->add($out,$rule,'BALANCE_DUPLICATE_ENTRY',$rule['path'],$i,$r,(string)$rule['key_field'],$key,['first_index'=>$seen[$key],'duplicate_index'=>$j]);else$seen[$key]=$j;}}
    }
    private function monotonic(array $docs,mixed $rule,array &$out):void
    {
        if(!is_array($rule)||!is_string($rule['path']??null)||!is_string($rule['field']??null))return;$data=$docs[$rule['path']]['data']??null;$seq=is_array($data)?($data[$rule['field']]??null):null;if(!is_array($seq)||!array_is_list($seq))return;for($i=1;$i<count($seq);$i++){if((!is_numeric($seq[$i-1])||!is_numeric($seq[$i]))||(($rule['direction']??'nondecreasing')==='nondecreasing'&&$seq[$i]<$seq[$i-1]))$this->add($out,$rule,'BALANCE_NOT_MONOTONIC',$rule['path'],$i,[],(string)$rule['field'],$seq[$i],['previous'=>$seq[$i-1]]);}
    }
    private function comparisons(array $docs,mixed $rule,array &$out):void
    {
        if(!is_array($rule)||!is_string($rule['path']??null))return;foreach($this->records($docs,$rule['path']) as $i=>$r){$l=$r[$rule['left']??'']??null;$rr=$r[$rule['right']??'']??null;if(!is_numeric($l)||!is_numeric($rr))continue;$ok=match($rule['operator']??'<='){'<='=>$l<=$rr,'>='=>$l>=$rr,'<'=>$l<$rr,'>'=>$l>$rr,'=='=>$l==$rr,default=>true};if(!$ok)$this->add($out,$rule,'BALANCE_COMPARISON',$rule['path'],$i,$r,(string)$rule['left'],$l,['operator'=>$rule['operator']??'<=','right_field'=>$rule['right']??'','right_value'=>$rr]);}
    }
    private function records(array $docs,string $path):array{$d=$docs[$path]['data']??[];return is_array($d)&&array_is_list($d)?$d:[];}
    private function add(array &$out,array $rule,string $code,string $path,int $index,array $record,string $field,mixed $actual,array $extra=[]):void{$out[]=array_merge(['severity'=>in_array($rule['severity']??'', ['critical','warning','info'],true)?$rule['severity']:'warning','code'=>$code,'path'=>$path,'index'=>$index,'record_id'=>is_string($record['id']??null)?$record['id']:null,'field'=>$field,'actual'=>$actual],$extra);}
    private function readRules():array{$p=dirname(__DIR__,2).'/schemas/balance-validation-rules.json';$raw=file_get_contents($p);if($raw===false)throw new ExportLoadException('BALANCE_CONFIG_MISSING','Unable to read balance rules.',['path'=>$p]);try{$v=json_decode($raw,true,512,JSON_THROW_ON_ERROR);}catch(\JsonException $e){throw new ExportLoadException('BALANCE_CONFIG_INVALID','Invalid balance rules JSON.',['path'=>$p],$e);}if(!is_array($v)||array_is_list($v))throw new ExportLoadException('BALANCE_CONFIG_INVALID','Balance rules root must be an object.',['path'=>$p]);return $v;}
}
