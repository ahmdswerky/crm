<?php

namespace Database\Seeders;

use App\Models\Property;
use Illuminate\Database\Seeder;

class PropertySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $batchCount = (int) config('crm.seeds.counts')[Property::class];
        $maxTotal = (int) config('crm.seeds.max_counts')[Property::class];
        $existingCount = Property::withTrashed()->count();
        $count = min($batchCount, max($maxTotal - $existingCount, 0));
        $chunkSize = 200;

        if (! $count) {
            return;
        }

        $usedTitles = Property::withTrashed()->pluck('title')->flip();
        $progressBar = $this->command->getOutput()->createProgressBar($count);
        $progressBar->setFormat(' %current%/%max% [%bar%] %percent:3s%%');
        $progressBar->start();

        for ($offset = 0; $offset < $count; $offset += $chunkSize) {
            $batchSize = min($chunkSize, $count - $offset);

            $rows = collect(Property::factory()
                ->count($batchSize)
                ->make()
                ->toArray())
                ->map(function (array $row) use ($usedTitles): array {
                    do {
                        $title = fake()->catchPhrase();
                    } while ($usedTitles->has($title));

                    $usedTitles->put($title, true);

                    return [
                        ...$row,
                        'title' => $title,
                    ];
                })->all();

            Property::insert($rows);
            $progressBar->advance($batchSize);
        }

        $progressBar->finish();
        $progressBar->clear();

        $this->command->outputComponents()->success("  {$count} properties generated successfully.");
    }
}
