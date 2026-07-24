<?php
declare(strict_types=1);
require __DIR__ . '/../cpf/bootstrap.php';
use GK\CPF\Core\CpfProjectManager;
use GK\CPF\Story\{CpfStoryImporter,CpfStoryStructureAnalyzer};
$root=sys_get_temp_dir().'/gk-build329-controlled-'.bin2hex(random_bytes(4));
try{
 (new CpfProjectManager())->create($root,'BUILD329-CONTROLLED','Controlled 10 Chapter Import');
 $input=__DIR__.'/../cpf/examples/guild-adventure-story-10chapters.json';
 $importer=new CpfStoryImporter();
 $a=$importer->importFile($root,$input,false);
 if(($a['chapter_count']??0)!==10) throw new RuntimeException('chapter count');
 if(count($a['created_node_ids']??[])<30) throw new RuntimeException('expected story, chapters and milestones');
 $b=$importer->importFile($root,$input,false);
 if(($b['idempotent']??false)!==true) throw new RuntimeException('idempotency');
 $report=(new CpfStoryStructureAnalyzer())->analyze($root,'STORY_GUILD_ADVENTURE');
 if(($report['metrics']['chapter_count']??0)!==10) throw new RuntimeException('analyzer chapter count');
 if(($report['issues']??[])!==[]) throw new RuntimeException('analyzer issues: '.json_encode($report['issues'],JSON_UNESCAPED_UNICODE));
 $latest=json_decode(file_get_contents($root.'/imports/STORY_GUILD_ADVENTURE/latest.json'),true);
 if(($latest['revision']??0)!==1 || strlen((string)($latest['normalized_hash']??''))!==64) throw new RuntimeException('snapshot');
 echo "PASS Build 329 controlled 10-chapter story import\n";
} finally { if(is_dir($root)) exec('rm -rf '.escapeshellarg($root)); }
