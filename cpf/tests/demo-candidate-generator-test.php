<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use GK\CPF\Core\CpfNodeManager;
use GK\CPF\Approval\CpfApprovalManager;
use GK\CPF\Demo\CpfDemoCandidateGenerator;
use GK\CPF\Revision\CpfRevisionRepository;

function failCandidate(string $message): never { fwrite(STDERR, "[FAIL] $message\n"); exit(1); }
function rmCandidate(string $dir): void { if (!is_dir($dir)) return; foreach (array_diff(scandir($dir) ?: [], ['.','..']) as $i) { $p="$dir/$i"; is_dir($p)&&!is_link($p)?rmCandidate($p):@unlink($p);} @rmdir($dir); }

$dir=sys_get_temp_dir().'/cpf-demo-candidate-'.bin2hex(random_bytes(4)); mkdir($dir,0777,true);
$nodes=new CpfNodeManager(); $approval=new CpfApprovalManager(); $generator=new CpfDemoCandidateGenerator(); $revisions=new CpfRevisionRepository();
try {
    $nodes->create($dir,'STORY_DEMO','story',['title'=>'Story']); $approval->approve($dir,'STORY_DEMO','test');
    $nodes->create($dir,'CH_DEMO','chapter',['title'=>'Chapter']); $approval->approve($dir,'CH_DEMO','test');
    $result=$generator->generate($dir);
    if (($result['human_approval_required']??false)!==true) failCandidate('human approval flag');
    if (count($result['generated']??[])!==2) failCandidate('plot and section candidates expected');
    $types=array_column($result['generated'],'target_type'); sort($types); if($types!==['plot','section']) failCandidate('generated types');
    foreach($result['generated'] as $item){$list=$revisions->list($dir,$item['node_id']); if(count($list)!==1||($list[0]['revision_status']??'')!=='CANDIDATE') failCandidate('candidate revision missing');}
    $again=$generator->generate($dir); if(count($again['generated']??[])!==0) failCandidate('duplicate generation must be blocked');
    $sectionItem=array_values(array_filter($result['generated'],fn($x)=>$x['target_type']==='section'))[0];
    $revisions->approveAndPromote($dir,$sectionItem['node_id'],$sectionItem['revision_id'],'test');
    $third=$generator->generate($dir); $scene=array_values(array_filter($third['generated']??[],fn($x)=>$x['target_type']==='scene'));
    if(count($scene)!==1) failCandidate('scene candidate expected after section approval');
    $sceneItem=$scene[0]; $revisions->approveAndPromote($dir,$sceneItem['node_id'],$sceneItem['revision_id'],'test');
    $fourth=$generator->generate($dir); $event=array_values(array_filter($fourth['generated']??[],fn($x)=>$x['target_type']==='event'));
    if(count($event)!==1) failCandidate('event candidate expected after scene approval');
    echo "[PASS] eligible missing nodes create candidate revisions only\n";
    echo "[PASS] duplicate open candidates are blocked\n";
    echo "[PASS] downstream scene and event wait for approved sources\n";
} finally { rmCandidate($dir); }
