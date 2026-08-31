<?php

namespace App\Console\Commands;

use App\Enums\DealStatus;
use App\Models\Deal;
use App\Services\CommissionService;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class RecalculateCommissionsCommand extends Command
{
    protected $signature = 'commission:recalculate {--all : Recalculate active deals and missing terminal snapshots}';

    protected $description = 'Recalculate active Deal commission estimates and missing snapshots';

    public function handle(CommissionService $commissionService): int
    {
        if (! $this->option('all')) {
            $this->components->error('Pass --all to recalculate active deals and missing terminal snapshots.');

            return self::INVALID;
        }

        $count = 0;

        Deal::query()
            ->select('id')
            ->where(function ($query): void {
                $query
                    ->whereIn('status', [
                        DealStatus::INQUIRY->value,
                        DealStatus::VIEWING->value,
                        DealStatus::OFFER_MADE->value,
                        DealStatus::LEGAL->value,
                    ])
                    ->orWhere(function ($query): void {
                        $query
                            ->whereIn('status', [DealStatus::WON->value, DealStatus::LOST->value])
                            ->where('commission_version', 0);
                    });
            })
            ->orderBy('id')
            ->chunkById(100, function (Collection $deals) use ($commissionService, &$count): void {
                DB::transaction(function () use ($commissionService, $deals): void {
                    $commissionService->recalculateBatch($deals);
                }, 3);
                $count += $deals->count();
            });

        $this->components->info("Recalculated {$count} deals.");

        return self::SUCCESS;
    }
}
