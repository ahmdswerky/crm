<?php

use App\Models\Property;
use App\Models\User;
use Database\Seeders\PropertySeeder;

test('property seeder inserts the configured count across bulk batches with unique titles', function () {
    config(['crm.seeds.counts' => [Property::class => 201]]);

    User::factory()->count(4)->create();

    $this->seed(PropertySeeder::class);

    expect(Property::query()->count())->toBe(201)
        ->and(Property::withTrashed()->pluck('title')->unique())->toHaveCount(201);
});

test('property seeder clamps a batch to the configured maximum total', function () {
    config([
        'crm.seeds.counts' => [Property::class => 201],
        'crm.seeds.max_counts' => [Property::class => 100],
    ]);

    User::factory()->count(4)->create();

    $this->seed(PropertySeeder::class);

    expect(Property::withTrashed()->count())->toBe(100);
});
