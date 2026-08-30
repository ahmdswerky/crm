<?php

namespace Database\Seeders;

use App\Enums\DealStatus;
use App\Enums\PropertyStatus;
use App\Models\Contact;
use App\Models\Deal;
use App\Models\Property;
use App\Services\CommissionService;
use App\Services\DealService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DealSeeder extends Seeder
{
    public function run(): void
    {
        $batchCount = (int) config('crm.seeds.counts')[Deal::class];
        $maxTotal = (int) config('crm.seeds.max_counts')[Deal::class];
        $existingCount = Deal::withTrashed()->count();
        $count = min($batchCount, max($maxTotal - $existingCount, 0));
        $chunkSize = 200;

//        if (! $count) {
            return;
 //       }

        $contacts = Contact::query()
            ->select(['id', 'assigned_agent_id'])
            ->get();
        $properties = Property::query()
            ->whereStatus(PropertyStatus::PENDING)
            ->select(['id', 'price'])
            ->get();

        if ($contacts->isEmpty()) {
            throw new RuntimeException('Cannot seed deals because no contacts exist.');
        }

        if ($properties->isEmpty()) {
            throw new RuntimeException('Cannot seed deals because no pending properties exist.');
        }

        $start = now()->subDays(config('crm.seeds.period.start'));
        $end = now();
        $progressBar = $this->command->getOutput()->createProgressBar($count);
        $progressBar->setFormat(' %current%/%max% [%bar%] %percent:3s%%');
        $progressBar->start();

        DB::transaction(function () use ($count, $chunkSize, $contacts, $properties, $start, $end, $progressBar): void {
            for ($offset = 0; $offset < $count; $offset += $chunkSize) {
                $batchSize = min($chunkSize, $count - $offset);
                $rows = $this->makeRows($batchSize, $contacts, $properties, $start, $end);

                Deal::insert($rows);
                $progressBar->advance($batchSize);
            }
        });

        $progressBar->finish();
        $progressBar->clear();

        $this->command->outputComponents()->success("  {$count} deals generated successfully.");

        // $deals->each(fn (Deal $deal) => app(CommissionService::class)->recalculate($deal));

        $propertyIds = Deal::query()
            ->select('property_id')
            ->distinct()
            ->pluck('property_id');
        $propertyCount = $propertyIds->count();

        if (! $propertyCount) {
            return;
        }

        $propertyProgressBar = $this->command->getOutput()->createProgressBar($propertyCount);
        $propertyProgressBar->setFormat(' %current%/%max% [%bar%] %percent:3s%%');
        $propertyProgressBar->start();

        $propertyIds->chunk(50)->each(function (Collection $ids) use ($propertyProgressBar): void {
            $ids->each(function ($propertyId) use ($propertyProgressBar): void {
                app(DealService::class)->synchronizePropertyStatus($propertyId);
                $propertyProgressBar->advance();
            });
        });

        $propertyProgressBar->finish();
        $propertyProgressBar->clear();

        $this->command->outputComponents()->success(
            "  {$propertyCount} property statuses synchronized successfully."
        );

    }

    private function makeRows(
        int $count,
        Collection $contacts,
        Collection $properties,
        \DateTimeInterface $start,
        \DateTimeInterface $end,
    ): array {
        return collect()->times($count, function () use ($contacts, $properties, $start, $end): array {
            $contact = $contacts->random();
            $property = $properties->random();
            $status = fake()->randomElement(DealStatus::cases());
            $value = $property->price;
            $createdAt = fake()->dateTimeBetween($start, $end);

            return [
                'value' => $value,
                'deal_value' => fake()->randomElement([
                    $value,
                    $value + (fake()->numberBetween(1, 10) * 10000 * fake()->randomElement([1, -1])),
                ]),
                'contact_id' => $contact->id,
                'property_id' => $property->id,
                'agent_id' => $contact->assigned_agent_id,
                'status' => $status->value,
                'commission_rate' => fake()->randomElement([2.5, 1.5]),
                'created_at' => $createdAt,
                'status_updated_at' => $createdAt,
                'closed_at' => $status === DealStatus::WON ? $createdAt : null,
            ];
        })->all();
    }
}
