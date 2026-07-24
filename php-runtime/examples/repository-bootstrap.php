<?php
declare(strict_types=1);

use GK\Export\ExportLoader;
use GK\Export\GameMasterRepository;

require_once dirname(__DIR__) . '/bootstrap.php';

$package = (new ExportLoader(['1.0.0']))->load(dirname(__DIR__, 2) . '/Export');
$masters = new GameMasterRepository($package);

// Game code no longer reads JSON paths or envelope fields directly.
$firstChapter = $masters->chapters()->find('CH001');
$slime = $masters->monsters()->find('MON001');
