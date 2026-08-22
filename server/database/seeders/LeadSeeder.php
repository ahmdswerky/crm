<?php

namespace Database\Seeders;

use App\Enums\LeadStatus;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use RuntimeException;
use Symfony\Component\Console\Helper\ProgressBar;

class LeadSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $batchCount = (int) config('crm.seeds.counts')[Lead::class];
        $maxTotal = (int) config('crm.seeds.max_counts')[Lead::class];
        $existingCount = Lead::withTrashed()->count();
        $count = min($batchCount, max($maxTotal - $existingCount, 0));
        $chunkSize = 200;

        if (! $count) {
            return;
        }

        $agents = User::query()->agents()->pluck('id');
        $usedEmails = Lead::withTrashed()->pluck('email')->flip();
        $usedPhones = Lead::withTrashed()->pluck('phone')->flip();

        $qualifiedAssignedCount = intdiv($count * 4, 5);
        $remainingCount = $count - $qualifiedAssignedCount;
        $splitCount = intdiv($remainingCount, 3);
        $remainder = $remainingCount % 3;

        // The remainder is distributed from the first bucket onwards so the
        // configured total is exact when the 20% remainder is not divisible by 3.
        $buckets = [
            [
                'count' => $qualifiedAssignedCount,
                'status' => LeadStatus::QUALIFIED,
                'assignment' => 'assigned',
            ],
            [
                'count' => $splitCount + ($remainder > 0 ? 1 : 0),
                'status' => LeadStatus::UNQUALIFIED,
                'assignment' => 'assigned',
            ],
            [
                'count' => $splitCount + ($remainder > 1 ? 1 : 0),
                'status' => LeadStatus::CONTACTED,
                'assignment' => 'mixed',
            ],
            [
                'count' => $splitCount,
                'status' => LeadStatus::PENDING,
                'assignment' => 'mixed',
            ],
        ];

        $assignedCount = $qualifiedAssignedCount + $splitCount + ($remainder > 0 ? 1 : 0);

        if ($agents->isEmpty() && $assignedCount > 0) {
            throw new RuntimeException('Cannot seed assigned leads because no agents exist.');
        }

        $inserted = 0;
        $progressBar = $this->command->getOutput()->createProgressBar($count);
        $progressBar->setFormat(' %current%/%max% [%bar%] %percent:3s%%');
        $progressBar->start();

        foreach ($buckets as $bucket) {
            if ($bucket['assignment'] === 'mixed') {
                $mixedAssignedCount = intdiv($bucket['count'] + 1, 2);

                $inserted += $this->insertBucket(
                    count: $mixedAssignedCount,
                    status: $bucket['status'],
                    assigned: true,
                    agents: $agents,
                    chunkSize: $chunkSize,
                    usedEmails: $usedEmails,
                    usedPhones: $usedPhones,
                    progressBar: $progressBar,
                );

                $inserted += $this->insertBucket(
                    count: $bucket['count'] - $mixedAssignedCount,
                    status: $bucket['status'],
                    assigned: false,
                    agents: $agents,
                    chunkSize: $chunkSize,
                    usedEmails: $usedEmails,
                    usedPhones: $usedPhones,
                    progressBar: $progressBar,
                );

                continue;
            }

            $inserted += $this->insertBucket(
                count: $bucket['count'],
                status: $bucket['status'],
                assigned: $bucket['assignment'] === 'assigned',
                agents: $agents,
                chunkSize: $chunkSize,
                usedEmails: $usedEmails,
                usedPhones: $usedPhones,
                progressBar: $progressBar,
            );
        }

        $progressBar->finish();
        $progressBar->clear();

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
        Collection $usedEmails,
        Collection $usedPhones,
        ProgressBar $progressBar,
    ): int {
        $inserted = 0;

        for ($offset = 0; $offset < $count; $offset += $chunkSize) {
            $batchSize = min($chunkSize, $count - $offset);

            $rows = collect(Lead::factory()
                ->count($batchSize)
                ->state(fn () => [
                    'status' => $status,
                    'assigned_agent_id' => $assigned ? $agents->random() : null,
                ])
                ->make()
                ->toArray())
                ->map(function (array $row) use ($usedEmails, $usedPhones): array {
                    do {
                        $email = fake()->safeEmail();
                    } while ($usedEmails->has($email));

                    do {
                        $phone = fake()->e164PhoneNumber();
                    } while ($usedPhones->has($phone));

                    $usedEmails->put($email, true);
                    $usedPhones->put($phone, true);

                    return [
                        ...$row,
                        'email' => $email,
                        'phone' => $phone,
                    ];
                })->all();

            Lead::insert($rows);
            $inserted += $batchSize;
            $progressBar->advance($batchSize);
        }

        return $inserted;
    }
}
