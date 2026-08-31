<?php

namespace App\Jobs;

use App\Models\ReportRun;
use App\Services\AnalyticsService;
use App\Services\ReportArchiveService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class GenerateAnalyticsReportJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 600;

    /** @var array<int, int> */
    public array $backoff = [60, 300, 900];

    public function __construct(public int $reportRunId)
    {
        $this->onQueue('reports');
    }

    public function handle(ReportArchiveService $archive, AnalyticsService $analytics): void
    {
        $run = ReportRun::query()->findOrFail($this->reportRunId);

        if ($run->status === 'completed') {
            return;
        }

        $archive->generate($run, $analytics);
    }

    public function failed(Throwable $exception): void
    {
        $run = ReportRun::query()->find($this->reportRunId);

        if ($run && $run->status !== 'completed') {
            app(ReportArchiveService::class)->markFailed($run, $exception);
        }
    }
}
