<?php

namespace App\Console\Commands;

use App\Services\AnalyticsService;
use App\Services\ReportArchiveService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Throwable;

class BackfillAnalyticsReportsCommand extends Command
{
    protected $signature = 'analytics:backfill
                            {--from= : Inclusive UTC start date (YYYY-MM-DD)}
                            {--to= : Inclusive UTC end date; defaults to yesterday}
                            {--daily-only : Generate only daily reports}
                            {--monthly-only : Generate only full monthly reports}
                            {--dry-run : List report periods without generating them}';

    protected $description = 'Generate missing historical daily and monthly analytics reports one at a time';

    public function handle(ReportArchiveService $archive, AnalyticsService $analytics): int
    {
        if (! $this->option('from')) {
            $this->components->error('Pass --from=YYYY-MM-DD to define the historical range.');

            return self::INVALID;
        }

        if ($this->option('daily-only') && $this->option('monthly-only')) {
            $this->components->error('Choose either --daily-only or --monthly-only, not both.');

            return self::INVALID;
        }

        try {
            $from = CarbonImmutable::parse((string) $this->option('from'), 'UTC')->startOfDay();
            $requestedTo = $this->option('to')
                ? CarbonImmutable::parse((string) $this->option('to'), 'UTC')->startOfDay()
                : CarbonImmutable::now('UTC')->startOfDay()->subDay();
        } catch (Throwable) {
            $this->components->error('Dates must use YYYY-MM-DD in UTC.');

            return self::INVALID;
        }

        $latestCompletedDay = CarbonImmutable::now('UTC')->startOfDay()->subDay();
        $to = $requestedTo->min($latestCompletedDay);

        if ($from->greaterThan($to)) {
            $this->components->error('The range must contain at least one completed UTC day.');

            return self::INVALID;
        }

        $periods = [];
        if (! $this->option('monthly-only')) {
            for ($day = $from; $day->lessThanOrEqualTo($to); $day = $day->addDay()) {
                $periods[] = ['daily', $day, $day->addDay()];
            }
        }

        if (! $this->option('daily-only')) {
            $month = $from->isStartOfMonth() ? $from : $from->startOfMonth()->addMonth();
            $firstDayAfterLastFullMonth = $to->addDay()->startOfMonth();
            for (; $month->lessThan($firstDayAfterLastFullMonth); $month = $month->addMonth()) {
                $periods[] = ['monthly', $month, $month->addMonth()];
            }
        }

        if ($periods === []) {
            $this->components->warn('No complete reporting periods fall inside the requested range.');

            return self::SUCCESS;
        }

        $generated = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($periods as [$cadence, $start, $end]) {
            $label = sprintf('%s %s', $cadence, $start->toDateString());

            if ($this->option('dry-run')) {
                $this->line("Would generate {$label}.");

                continue;
            }

            $run = $archive->createRun('sales_pipeline', $cadence, $start, $end);

            if ($run->status === 'completed') {
                $skipped++;
                $this->line("Skipped {$label}; it is already complete.");

                continue;
            }

            try {
                $this->line("Generating {$label}…");
                $archive->generate($run, $analytics);
                $generated++;
            } catch (Throwable $exception) {
                $archive->markFailed($run, $exception);
                $failed++;
                $this->components->error("Failed {$label}: {$exception->getMessage()}");
            }
        }

        $this->components->info("Generated {$generated}; skipped {$skipped}; failed {$failed}.");

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }
}
