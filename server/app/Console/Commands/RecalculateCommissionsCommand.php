<?php

namespace App\Console\Commands;

use App\Models\Deal;
use App\Services\CommissionService;
use Illuminate\Console\Command;

class RecalculateCommissionsCommand extends Command
{
    protected $signature = 'commission:recalculate {--all : Recalculate every non-deleted deal}';

    protected $description = 'Recalculate stored Deal commission estimates and snapshots';

    public function handle(CommissionService $commissionService): int
    {
        if (! $this->option('all')) {
            $this->components->error('Pass --all to recalculate all non-deleted deals.');

            return self::INVALID;
        }

        $count = 0;

        Deal::query()
            ->select('id')
            ->orderBy('id')
            ->chunkById(100, function ($deals) use ($commissionService, &$count): void {
                echo $deals->count();
                foreach ($deals as $deal) {
                    $commissionService->recalculate($deal);
                    $count++;
                }
            });

        $this->components->info("Recalculated {$count} deals.");

        return self::SUCCESS;
    }
}
