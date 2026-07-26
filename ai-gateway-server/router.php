<?php
declare(strict_types=1);

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(503); header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error'=>'AI Gateway server is not configured.','setup'=>'Copy config.example.php to config.php and set a token.'], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT); exit;
}
$config = require $configFile;
$root = realpath((string)($config['root'] ?? dirname(__DIR__)));
$snapshotFile = (string)($config['snapshot_file'] ?? (__DIR__.'/runtime/current-context.json'));
$allowedOrigins = (array)($config['allowed_origins'] ?? []);
$token = (string)($config['token'] ?? '');
$requestId = bin2hex(random_bytes(8));

function jsonResponse(mixed $data, int $status=200): never {
    global $requestId;
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('X-Request-Id: '.$requestId);
    if (is_array($data) && !isset($data['requestId'])) $data['requestId']=$requestId;
    echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT); exit;
}
function requestToken(): string {
    $header=$_SERVER['HTTP_AUTHORIZATION']??'';
    if (preg_match('/^Bearer\s+(.+)$/i',$header,$m)) return trim($m[1]);
    return (string)($_GET['token']??'');
}
function safePath(string $root,string $path): ?string {
    $path=str_replace('\\','/',trim($path));
    if ($path===''||str_starts_with($path,'/')||str_contains($path,'../')) return null;
    $candidate=realpath($root.DIRECTORY_SEPARATOR.$path);
    if ($candidate===false||!str_starts_with($candidate,$root.DIRECTORY_SEPARATOR)||!is_file($candidate)) return null;
    return $candidate;
}
function loadManifest(string $root): array {
    $data=json_decode((string)@file_get_contents($root.'/ai-gateway-manifest.json'),true);
    return is_array($data)?$data:[];
}
function loadSnapshot(string $snapshotFile): ?array {
    if (!is_file($snapshotFile)) return null;
    $data=json_decode((string)file_get_contents($snapshotFile),true);
    return is_array($data)?$data:null;
}
function allowedFile(array $manifest,string $path): bool { return in_array($path,(array)($manifest['allowedFiles']??[]),true); }
function classify(string $path): string {
    return match(strtolower(pathinfo($path,PATHINFO_EXTENSION))){'php','js','html','css'=>'source','json'=>'data','md','txt'=>'document',default=>'other'};
}
function handoverPayload(string $root,array $manifest): array {
    $files=[];
    foreach ((array)($manifest['handoverFiles']??[]) as $relative) {
        if (!allowedFile($manifest,$relative)) continue;
        $file=safePath($root,$relative); if (!$file) continue;
        $files[]=['path'=>$relative,'bytes'=>filesize($file),'content'=>file_get_contents($file)];
    }
    return ['generatedAt'=>gmdate(DATE_ATOM),'build'=>$manifest['build']??null,'files'=>$files];
}

$origin=$_SERVER['HTTP_ORIGIN']??'';
if ($origin!==''&&in_array($origin,$allowedOrigins,true)) {
    header('Access-Control-Allow-Origin: '.$origin); header('Vary: Origin');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}
if ($_SERVER['REQUEST_METHOD']==='OPTIONS') { http_response_code(204); exit; }
if ($root===false) jsonResponse(['error'=>'Invalid server root.'],500);
if ($token===''||$token==='CHANGE_ME_TO_A_LONG_RANDOM_TOKEN') jsonResponse(['error'=>'Secure token is not configured.'],503);
if (!hash_equals($token,requestToken())) jsonResponse(['error'=>'Unauthorized.'],401);

$manifest=loadManifest($root);
$snapshot=loadSnapshot($snapshotFile);
$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/';

if ($path==='/ai/health') jsonResponse(['ok'=>true,'gatewayVersion'=>'0.8.0','build'=>$manifest['build']??null,'mode'=>'read-only']);
if ($path==='/ai/status') jsonResponse(['ok'=>true,'gatewayVersion'=>'0.8.0','build'=>$manifest['build']??null,'mode'=>'read-only','snapshot'=>['available'=>$snapshot!==null,'syncedAt'=>$snapshot['serverSyncedAt']??null],'capabilities'=>$manifest['capabilities']??[]]);
if ($path==='/ai/manifest') jsonResponse($manifest);
if ($path==='/ai/context') {
    if ($snapshot!==null) jsonResponse($snapshot);
    $project=json_decode((string)@file_get_contents($root.'/project-data.json'),true);
    jsonResponse(['schemaVersion'=>'1.3.0','gatewayVersion'=>'0.8.0','generatedAt'=>gmdate(DATE_ATOM),'build'=>$manifest['build']??null,'source'=>'project-data.json','project'=>is_array($project)?$project:[]]);
}
if ($path==='/ai/project') jsonResponse($snapshot['project']??['error'=>'No Studio snapshot has been synchronized.'], $snapshot===null?409:200);
if ($path==='/ai/validation') jsonResponse($snapshot['validation']??['error'=>'No Studio snapshot has been synchronized.'], $snapshot===null?409:200);
if ($path==='/ai/handover') jsonResponse(handoverPayload($root,$manifest));
if ($path==='/ai/files') {
    $files=[]; foreach ((array)($manifest['allowedFiles']??[]) as $relative) {
        $file=safePath($root,$relative);
        $files[]=$file?['path'=>$relative,'type'=>classify($relative),'bytes'=>filesize($file),'lines'=>count(file($file))]:['path'=>$relative,'error'=>'unavailable'];
    }
    jsonResponse(['generatedAt'=>gmdate(DATE_ATOM),'total'=>count($files),'files'=>$files]);
}
if ($path==='/ai/file'||$path==='/ai/file-range') {
    $relative=(string)($_GET['path']??'');
    if (!allowedFile($manifest,$relative)) jsonResponse(['error'=>'File is not permitted.'],403);
    $file=safePath($root,$relative); if (!$file) jsonResponse(['error'=>'File not found.'],404);
    $content=(string)file_get_contents($file);
    if ($path==='/ai/file') jsonResponse(['path'=>$relative,'bytes'=>filesize($file),'sha256'=>hash_file('sha256',$file),'content'=>$content]);
    $lines=preg_split('/\R/u',$content)?:[];
    $start=max(1,(int)($_GET['start']??1)); $end=max($start,(int)($_GET['end']??($start+199)));
    if (($end-$start+1)>500) jsonResponse(['error'=>'Line range is limited to 500 lines.'],400);
    $end=min(count($lines),$end);
    jsonResponse(['path'=>$relative,'start'=>$start,'end'=>$end,'totalLines'=>count($lines),'content'=>implode("\n",array_slice($lines,$start-1,max(0,$end-$start+1)))]);
}
if ($path==='/ai/search') {
    $query=trim((string)($_GET['q']??'')); $limit=max(1,min(100,(int)($_GET['limit']??20)));
    if ($query==='') jsonResponse(['error'=>'Search query is required.'],400);
    $results=[]; foreach ((array)($manifest['allowedFiles']??[]) as $relative) {
        if (count($results)>=$limit) break; $file=safePath($root,$relative); if (!$file) continue;
        $content=(string)file_get_contents($file); $pos=mb_stripos($content,$query);
        if ($pos!==false||mb_stripos($relative,$query)!==false) {
            $excerpt=$pos===false?'':mb_substr($content,max(0,$pos-120),360);
            $results[]=['path'=>$relative,'type'=>classify($relative),'excerpt'=>$excerpt];
        }
    }
    jsonResponse(['query'=>$query,'count'=>count($results),'results'=>$results]);
}
if ($path==='/bridge/snapshot'&&$_SERVER['REQUEST_METHOD']==='POST') {
    if ($origin===''||!in_array($origin,$allowedOrigins,true)) jsonResponse(['error'=>'Snapshot sync requires an allowed Studio origin.'],403);
    $payload=json_decode((string)file_get_contents('php://input'),true);
    if (!is_array($payload)) jsonResponse(['error'=>'Invalid JSON.'],400);
    $payload['serverSyncedAt']=gmdate(DATE_ATOM); $payload['gatewayVersion']='0.8.0';
    if (!is_dir(dirname($snapshotFile))) mkdir(dirname($snapshotFile),0775,true);
    $tmp=$snapshotFile.'.tmp'; file_put_contents($tmp,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT),LOCK_EX); rename($tmp,$snapshotFile);
    jsonResponse(['ok'=>true,'syncedAt'=>$payload['serverSyncedAt']]);
}
jsonResponse(['error'=>'Route not found.'],404);
