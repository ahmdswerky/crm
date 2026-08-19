<?php

namespace Database\Seeders;

use App\Models\Property;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;

class PropertySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $count = config('crm.seeds.counts')[Property::class];
        $chunkSize = 200;
        $operations = collect([]);

        if ($existingCount = Property::count()) {
            $count = max($count - $existingCount, 0);
        }

        if (!$count) {
            return;
        }

        collect()->times(ceil($count / $chunkSize))->map(function () use ($chunkSize, &$operations) {
            Property::factory($chunkSize)
                ->make()
                ->chunk(50)
                ->map(function (Collection $chunked) use (&$operations) {
                    $operations[] = (int) Property::insert($chunked->toArray());
                });
        });

        $counts = [
            'failed' => $operations->filter(fn ($v) => $v !== 1)->count() * 50,
            'succeed' => $operations->filter(fn ($v) => $v === 1)->count() * 50,
        ];

        if ($counts['failed']) {
            $this->command->outputComponents()->error("  " . ($count - $counts['failed']) . ' properties failed');
        }

        $this->command->outputComponents()->success('  ' . Property::count() . ' properties generated successfully.');
    }
}
