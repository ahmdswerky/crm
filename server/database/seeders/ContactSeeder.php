<?php

namespace Database\Seeders;

use App\Enums\LeadStatus;
use App\Models\Contact;
use App\Models\Lead;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;

class ContactSeeder extends Seeder
{
    public function run(): void
    {
        $count = config('crm.seeds.counts')[Lead::class];
        $chunkSize = 200;
        $operations = collect([]);

        if ($existingCount = Contact::count()) {
            $count = max($count - $existingCount, 0);
        }

        if (!$count) {
            return;
        }

        collect()->times(ceil($count * .8 / $chunkSize))->map(function () use ($chunkSize, &$operations) {
            $perTime = 20;

            collect()
                ->times($chunkSize)
                ->map(function () use (&$operations, $perTime) {
                    Contact::factory()->create();

                    $operations->push(1);
                    // $operations = $operations->merge(
                    //     array_fill(0, $perTime, 1),
                    // );
                });
        });

        Contact::pluck('lead_id')->chunk(50)->map(function (Collection $ids) {
            Lead::whereIn('id', $ids)
                ->update([
                    'status' => LeadStatus::QUALIFIED,
                ]);
        });

        $counts = [
            'failed' => $operations->filter(fn ($v) => $v !== 1)->count() * 50,
            'succeed' => $operations->filter(fn ($v) => $v === 1)->count() * 50,
        ];

        if ($counts['failed']) {
            $this->command->outputComponents()->error("  " . ($count - $counts['failed']) . ' contacts failed');
        }

        $this->command->outputComponents()->success('  ' . $counts['succeed'] . ' contacts generated successfully.');
    }
}
