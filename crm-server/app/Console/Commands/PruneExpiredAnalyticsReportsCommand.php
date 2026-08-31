<?php

namespace App\Console\Commands;

use App\Models\ReportRun;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PruneExpiredAnalyticsReportsCommand extends Command
{
    protected $signature = 'analytics:prune-reports';

    protected $description = 'Delete expired daily report snapshots and private CSV artifacts';

    public function handle(): int
    {
        $count = 0;

        ReportRun::query()
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now('UTC'))
            ->orderBy('id')
            ->chunkById(100, function ($runs) use (&$count): void {
                foreach ($runs as $run) {
                    if ($run->csv_path) {
                        Storage::disk('local')->delete($run->csv_path);
                    }
                    $run->delete();
                    $count++;
                }
            });

        $this->components->info("Pruned {$count} expired report runs.");

        return self::SUCCESS;
    }
}
