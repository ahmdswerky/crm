<?php

namespace Database\Seeders;

use App\Models\Deal;
use App\Services\CommissionService;
use App\Services\DealService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;

class DealSeeder extends Seeder
{
    public function run(): void
    {
        $count = config('crm.seeds.counts')[Deal::class];
        $chunkSize = 200;
        $operations = collect([]);

        if ($existingCount = Deal::count()) {
            $count = max($count - $existingCount, 0);
        }

        if (!$count) {
            return;
        }

        collect()->times(ceil($count / $chunkSize))->map(function () use ($chunkSize, &$operations) {
            Deal::factory($chunkSize)
                ->make()
                ->chunk(50)
                ->map(function (Collection $chunked) use (&$operations) {
                    $operations[] = (int) Deal::insert($chunked->toArray());
                });
        });

        $counts = [
            'failed' => $operations->filter(fn ($v) => $v !== 1)->count() * 50,
            'succeed' => $operations->filter(fn ($v) => $v === 1)->count() * 50,
        ];

        if ($counts['failed']) {
            $this->command->outputComponents()->error("  " . ($count - $counts['failed']) . ' deals failed');
        }

        $this->command->outputComponents()->success('  ' . $counts['succeed'] . ' deals generated successfully.');

        // $deals->each(fn (Deal $deal) => app(CommissionService::class)->recalculate($deal));

        Deal::pluck('property_id')->chunk(50)->map(function (Collection $ids) {
            $ids->map(function ($propertyId) {
                app(DealService::class)->synchronizePropertyStatus($propertyId);
            });
        });


    }
}
