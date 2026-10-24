<?php

use App\Enums\DealStatus;
use App\Enums\PropertyStatus;
use App\Models\Contact;
use App\Models\Deal;
use App\Models\Property;
use Database\Seeders\DealSeeder;

test('deal seeder gives every converted contact exactly one deal', function () {
    config(['crm.seeds.max_counts' => [Deal::class => 1000]]);
    seedDealSources(205);

    $this->seed(DealSeeder::class);
    $this->seed(DealSeeder::class);

    expect(Deal::query()->count())->toBe(205)
        ->and(Contact::query()->whereDoesntHave('deals')->count())->toBe(0)
        ->and(Deal::query()->distinct()->count('contact_id'))->toBe(205)
        ->and(Deal::query()->distinct()->count('property_id'))->toBe(205)
        ->and(Deal::query()->where('status', '!=', DealStatus::WON)->orWhereNull('closed_at')->count())->toBe(0)
        ->and(Property::query()->where('status', '!=', PropertyStatus::SOLD)->count())->toBe(0)
        ->and(Deal::query()->with('contact')->get()
            ->every(fn (Deal $deal) => $deal->created_at->greaterThanOrEqualTo($deal->contact->created_at)
                && $deal->agent_id === $deal->contact->assigned_agent_id))->toBeTrue();
});

test('deal seeder clamps to the configured maximum total', function () {
    config(['crm.seeds.max_counts' => [Deal::class => 3]]);
    seedDealSources(5);

    $this->seed(DealSeeder::class);

    expect(Deal::withTrashed()->count())->toBe(3);
});

test('deal seeder never sells a property twice when properties run short', function () {
    seedDealSources(5, 2);

    $this->seed(DealSeeder::class);

    expect(Deal::query()->count())->toBe(2)
        ->and(Deal::query()->distinct()->count('property_id'))->toBe(2);
});
