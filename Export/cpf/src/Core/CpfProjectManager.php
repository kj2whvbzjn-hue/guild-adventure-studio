<?php
declare(strict_types=1); namespace GK\CPF\Core;
final class CpfProjectManager {
 public function __construct(private JsonStore $store=new JsonStore()){}
 public function create(string $dir,string $id,string $title): array { if(is_dir($dir)&&is_file("$dir/project.json")) throw new CpfException('PROJECT_EXISTS','Project already exists'); foreach(['nodes','history','dependencies','regeneration','revisions','migrations'] as $d) @mkdir("$dir/$d",0777,true); $now=date(DATE_ATOM); $p=['project_id'=>$id,'title'=>$title,'status'=>'ACTIVE','current_phase'=>'CPF-002A','story_version'=>1,'schema_version'=>2,'created_at'=>$now,'updated_at'=>$now]; $this->store->write("$dir/project.json",$p); $this->store->write("$dir/migrations/state.json",['schema_version'=>2,'applied'=>[]]); return $p; }
 public function load(string $dir): array { $p=$this->store->read("$dir/project.json",null); if(!is_array($p)) throw new CpfException('PROJECT_NOT_FOUND','Project not found'); return $p; }
 public function save(string $dir,array $p): void {$p['updated_at']=date(DATE_ATOM);$this->store->write("$dir/project.json",$p);}
}