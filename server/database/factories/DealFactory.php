<?php

namespace Database\Factories;

use App\Enums\DealStatus;
use App\Models\Contact;
use App\Models\Deal;
use App\Models\Property;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Deal>
 */
class DealFactory extends Factory
{
    protected $model = Deal::class;

    public function definition(): array
    {
        return [
            'value' => fake()->randomFloat(2, 10, 10000),
            'deal_value' => fake()->randomFloat(2, 10, 10000),
            'contact_id' => Contact::query()->inRandomOrder()->first()->id,
            'property_id' => Property::query()->inRandomOrder()->first()->id,
            'status' => fake()->randomElement(DealStatus::cases()),
            'commission_rate' => fake()->randomFloat(2, 0, 100),
            'closed_at' => fake()->randomElement([fake()->dateTimeBetween(now()->subDays(2), now()->subDay()), null]),
        ];
    }
}
