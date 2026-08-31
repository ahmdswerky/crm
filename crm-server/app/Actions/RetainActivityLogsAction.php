<?php

namespace App\Actions;

use Spatie\Activitylog\Actions\CleanActivityLogAction;

class RetainActivityLogsAction extends CleanActivityLogAction
{
    public function execute(int $maxAgeInDays, ?string $logName = null): int
    {
        return 0;
    }
}
