<?php

namespace Database\Seeders;

use App\Enums\LeadStatus;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;

class LeadSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $targetCount = config('crm.seeds.counts')[Lead::class];
        $existingCount = Lead::count();
        $count = max($targetCount - $existingCount, 0);
        $chunkSize = 200;

        if (! $count) {
            return;
        }

        $agents = User::query()->agents()->pluck('id');

        $assignedPendingCount = intdiv($count * 4, 5);
        $remainingCount = $count - $assignedPendingCount;
        $splitCount = intdiv($remainingCount, 3);
        $remainder = $remainingCount % 3;

        // The remainder is distributed from the first bucket onwards so the
        // configured total is exact when the 20% remainder is not divisible by 3.
        $buckets = [
            [
                'count' => $assignedPendingCount,
                'status' => LeadStatus::PENDING,
                'assigned' => true,
            ],
            [
                'count' => $splitCount + ($remainder > 0 ? 1 : 0),
                'status' => LeadStatus::PENDING,
                'assigned' => false,
            ],
            [
                'count' => $splitCount + ($remainder > 1 ? 1 : 0),
                'status' => LeadStatus::CONTACTED,
                'assigned' => false,
            ],
            [
                'count' => $splitCount,
                'status' => LeadStatus::UNQUALIFIED,
                'assigned' => false,
            ],
        ];

        if ($agents->isEmpty() && $assignedPendingCount > 0) {
            throw new \RuntimeException('Cannot seed assigned leads because no agents exist.');
        }

        $inserted = 0;

        foreach ($buckets as $bucket) {
            $inserted += $this->insertBucket(
                count: $bucket['count'],
                status: $bucket['status'],
                assigned: $bucket['assigned'],
                agents: $agents,
                chunkSize: $chunkSize,
            );
        }

        $this->command->outputComponents()->success(
            "  {$inserted} leads generated successfully."
        );
    }

    private function insertBucket(
        int $count,
        LeadStatus $status,
        bool $assigned,
        Collection $agents,
        int $chunkSize,
    ): int {
        $inserted = 0;

        for ($offset = 0; $offset < $count; $offset += $chunkSize) {
            $batchSize = min($chunkSize, $count - $offset);

            $rows = Lead::factory()
                ->count($batchSize)
                ->state(fn () => [
                    'status' => $status,
                    'assigned_agent_id' => $assigned ? $agents->random() : null,
                ])
                ->make()
                ->toArray();

            Lead::insert($rows);
            $inserted += $batchSize;
        }

        return $inserted;
    }
}
