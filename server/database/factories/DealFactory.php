<?php

namespace Database\Factories;

use App\Enums\DealStatus;
use App\Enums\PropertyStatus;
use App\Models\Contact;
use App\Models\Deal;
use App\Models\Property;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Deal>
 */
class DealFactory extends Factory
{
    protected $model = Deal::class;

    public function definition(): array
    {
        $property = Property::query()
            ->whereStatus(PropertyStatus::PENDING)
            ->inRandomOrder()
            ->first();

        return [
            'value' => $value = $property->price,
            'deal_value' => fake()->randomElement([$value, $value + (fake()->numberBetween(1, 10) * 10000 * fake()->randomElement([1, -1]))]),
            'contact_id' => Contact::query()->inRandomOrder()->value('id'),
            'property_id' => $property->id,
            'agent_id' => User::query()->agents()->inRandomOrder()->value('id'),
            'status' => fake()->randomElement(DealStatus::cases()),
            'commission_rate' => fake()->randomElement([2.5, 1.5]),
            'closed_at' => fake()->randomElement([fake()->dateTimeBetween(now()->subDays(2), now()->subDay()), null]),
        ];
    }
}
