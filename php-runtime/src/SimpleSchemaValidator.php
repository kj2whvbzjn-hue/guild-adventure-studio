<?php
declare(strict_types=1);
namespace GK\Export;
final class SimpleSchemaValidator {
 public function validate(mixed $value,array $schema,string $path='$'): void {
  if(isset($schema['type'])) $this->assertType($value,(string)$schema['type'],$path);
  if(is_string($value)){ $length=preg_match_all('/./us',$value,$m) ? count($m[0]) : 0; if(isset($schema['minLength'])&&$length<(int)$schema['minLength'])$this->fail($path,'minLength'); if(isset($schema['enum'])&&!in_array($value,$schema['enum'],true))$this->fail($path,'enum'); }
  if(is_int($value)||is_float($value)){ if(isset($schema['minimum'])&&$value<$schema['minimum'])$this->fail($path,'minimum'); if(isset($schema['maximum'])&&$value>$schema['maximum'])$this->fail($path,'maximum'); }
  if(is_array($value)&&array_is_list($value)&&(($schema['type']??null)!=='object')){ if(isset($schema['items'])&&is_array($schema['items'])) foreach($value as $i=>$v)$this->validate($v,$schema['items'],$path.'['.$i.']'); if(($schema['uniqueItems']??false)===true&&count($value)!==count(array_unique(array_map('serialize',$value))))$this->fail($path,'uniqueItems'); }
  if(is_array($value)&&(($schema['type']??null)==='object'||!array_is_list($value))){ $req=$schema['required']??[]; foreach($req as $k)if(!array_key_exists($k,$value))$this->fail($path.'.'.$k,'required'); $props=$schema['properties']??[]; foreach($props as $k=>$s)if(array_key_exists($k,$value)&&is_array($s))$this->validate($value[$k],$s,$path.'.'.$k); if(($schema['additionalProperties']??true)===false){$extra=array_diff(array_keys($value),array_keys($props));if($extra)$this->fail($path,'additionalProperties');}}
 }
 private function assertType(mixed $v,string $t,string $p):void{$ok=match($t){'array'=>is_array($v)&&array_is_list($v),'object'=>is_array($v)&&($v===[]||!array_is_list($v)),'string'=>is_string($v),'integer'=>is_int($v),'number'=>is_int($v)||is_float($v),'boolean'=>is_bool($v),'null'=>$v===null,default=>false};if(!$ok)$this->fail($p,'type '.$t);}
 private function fail(string $path,string $rule):never{throw new ExportLoadException('DATA_SCHEMA_INVALID',"Schema violation at {$path}: {$rule}",['field_path'=>$path,'rule'=>$rule]);}
}
