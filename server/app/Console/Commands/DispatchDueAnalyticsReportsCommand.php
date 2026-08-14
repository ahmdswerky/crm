<?php

namespace App\Console\Commands;

use App\Services\ReportArchiveService;
use Illuminate\Console\Command;

class DispatchDueAnalyticsReportsCommand extends Command
{
    protected $signature = 'analytics:dispatch-due';

    protected $description = 'Queue the scheduled UTC Sales & Pipeline reports that are due';

    public function handle(ReportArchiveService $reports): int
    {
        $now = now('UTC');
        $dailyReadyAt = $now->copy()->startOfDay()->addMinutes(10);

        if ($now->greaterThanOrEqualTo($dailyReadyAt)) {
            $end = $now->copy()->startOfDay();
            $reports->queue('sales_pipeline', 'daily', $end->copy()->subDay(), $end);
        }

        if ($now->day === 1 && $now->greaterThanOrEqualTo($dailyReadyAt)) {
            $end = $now->copy()->startOfMonth();
            $reports->queue('sales_pipeline', 'monthly', $end->copy()->subMonthNoOverflow(), $end);
        }

        return self::SUCCESS;
    }
}
