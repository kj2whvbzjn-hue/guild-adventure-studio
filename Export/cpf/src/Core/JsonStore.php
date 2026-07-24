<?php
declare(strict_types=1); namespace GK\CPF\Core;
final class JsonStore {
 public function read(string $path, mixed $default=[]): mixed { if(!is_file($path)) return $default; $v=json_decode((string)file_get_contents($path),true); if(json_last_error()!==JSON_ERROR_NONE) throw new CpfException('JSON_INVALID',"Invalid JSON: $path"); return $v; }
 public function write(string $path,mixed $data): void { @mkdir(dirname($path),0777,true); $tmp=$path.'.tmp.'.bin2hex(random_bytes(4)); $json=json_encode($data,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); if($json===false||file_put_contents($tmp,$json."\n",LOCK_EX)===false) throw new CpfException('WRITE_FAILED',"Cannot write: $path"); if(!rename($tmp,$path)){@unlink($tmp);throw new CpfException('WRITE_FAILED',"Cannot replace: $path");} }
}