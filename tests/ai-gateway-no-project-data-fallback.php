<?php
$src=file_get_contents(__DIR__.'/../ai-gateway-server/router.php');
$manifest=json_decode(file_get_contents(__DIR__.'/../ai-gateway-manifest.json'),true);
if(strpos($src,"file_get_contents(\$root.'/project-data.json')")!==false){fwrite(STDERR,"root fallback remains\n");exit(1);}
if(strpos($src,"No Studio snapshot has been synchronized.")===false){fwrite(STDERR,"409 snapshot fail closed missing\n");exit(1);}
if(in_array('project-data.json',$manifest['allowedFiles']??[],true)){fwrite(STDERR,"gateway allowlist still exposes project-data\n");exit(1);}
echo "AI_GATEWAY_NO_PROJECT_DATA_FALLBACK_OK\n";
