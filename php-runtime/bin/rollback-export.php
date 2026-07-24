#!/usr/bin/env php
<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/bootstrap.php';
use GK\Export\ExportRollbackManager; use GK\Export\ExportLoadException;
$backup=$argv[1]??''; $target=$argv[2]??'';
if($backup===''||$target===''){fwrite(STDERR,"Usage: php php-runtime/bin/rollback-export.php <backup-export> <live-export>\n");exit(2);} 
try{$pkg=(new ExportRollbackManager())->restore($backup,$target);fwrite(STDOUT,'Rollback completed: '.count($pkg->paths())." files\n");exit(0);}catch(ExportLoadException $e){fwrite(STDERR,'['.$e->errorCode.'] '.$e->getMessage()."\n");exit(1);} 
