#!/usr/bin/env php
<?php
declare(strict_types=1);
fwrite(STDERR, json_encode(['ok'=>false,'error_code'=>'GENERATOR_NOT_IMPLEMENTED','message'=>'Generation is scheduled for CPF-002 and later.'], JSON_UNESCAPED_UNICODE)."\n");
exit(1);
