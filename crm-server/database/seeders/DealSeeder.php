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
        // Every contact is a converted lead that bought: each one without a deal gets one won deal.
        $maxTotal = (int) config('crm.seeds.max_counts')[Deal::class];
        $contacts = Contact::query()
            ->whereDoesntHave('deals', fn ($query) => $query->withTrashed())
            ->select(['id', 'assigned_agent_id', 'created_at'])
            ->orderBy('id')
            ->limit(max($maxTotal - Deal::withTrashed()->count(), 0))
            ->get();
        $chunkSize = 200;

        if ($contacts->isEmpty()) {
            return;
        }

        // A property can only be sold once, so every won deal takes its own unsold property.
        $properties = Property::query()
            ->whereStatus(PropertyStatus::PENDING)
            ->select(['id', 'price'])
            ->inRandomOrder()
            ->limit($contacts->count())
            ->get();

        if ($properties->isEmpty()) {
            throw new RuntimeException('Cannot seed deals because no pending properties exist.');
        }

        if ($properties->count() < $contacts->count()) {
            $this->command->outputComponents()->warn(
                '  Only '.$properties->count().' pending properties for '.$contacts->count().' contacts; seed more properties and re-run for the rest.'
            );
        }

        $sales = $contacts->take($properties->count())->values()->zip($properties);
        $count = $sales->count();

        $end = now();
        $progressBar = $this->command->getOutput()->createProgressBar($count);
        $progressBar->setFormat(' %current%/%max% [%bar%] %percent:3s%%');
        $progressBar->start();

        DB::transaction(function () use ($chunkSize, $sales, $end, $progressBar): void {
            $sales->chunk($chunkSize)->each(function (Collection $chunk) use ($end, $progressBar): void {
                Deal::insert($this->makeRows($chunk, $end));
                $progressBar->advance($chunk->count());
            });
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

    private function makeRows(Collection $sales, \DateTimeInterface $end): array
    {
        return $sales->map(function (Collection $sale) use ($end): array {
            [$contact, $property] = $sale->all();
            $value = $property->price;
            // A deal opens only after its lead was converted into this contact, and closes later.
            $createdAt = fake()->dateTimeBetween($contact->created_at ?? $end, $end);
            $closedAt = fake()->dateTimeBetween($createdAt, $end);

            return [
                'value' => $value,
                'deal_value' => fake()->randomElement([
                    $value,
                    $value + (fake()->numberBetween(1, 10) * 10000 * fake()->randomElement([1, -1])),
                ]),
                'contact_id' => $contact->id,
                'property_id' => $property->id,
                'agent_id' => $contact->assigned_agent_id,
                'status' => DealStatus::WON->value,
                'commission_rate' => fake()->randomElement([2.5, 1.5]),
                'created_at' => $createdAt,
                'status_updated_at' => $closedAt,
                'closed_at' => $closedAt,
            ];
        })->values()->all();
    }
}
