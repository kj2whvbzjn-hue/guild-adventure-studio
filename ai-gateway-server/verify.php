<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$manifest=json_decode((string)file_get_contents($root.'/ai-gateway-manifest.json'),true,512,JSON_THROW_ON_ERROR);
$required=['/ai/health','/ai/status','/ai/context','/ai/project','/ai/validation','/ai/handover','/ai/files','/ai/manifest'];
foreach($required as $route){ if(!in_array($route,$manifest['routes'],true)) throw new RuntimeException("Missing route: $route"); }
foreach($manifest['allowedFiles'] as $file){ if(!is_file($root.'/'.$file)) throw new RuntimeException("Missing allowed file: $file"); }
echo "AI Gateway v0.8 static verification: OK\n";
