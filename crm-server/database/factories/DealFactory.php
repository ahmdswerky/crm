<?php

namespace Database\Factories;

use App\Enums\DealStatus;
use App\Enums\PropertyStatus;
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
        $startInDays = config('crm.seeds.period.start');
        $contact = Contact::select(['id', 'assigned_agent_id'])->inRandomOrder()->first();
        $property = Property::query()
            ->whereStatus(PropertyStatus::PENDING)
            ->inRandomOrder()
            ->first();

        $status = fake()->randomElement(DealStatus::cases());

        return [
            'value' => $value = $property->price,
            'deal_value' => fake()->randomElement([$value, $value + (fake()->numberBetween(1, 10) * 10000 * fake()->randomElement([1, -1]))]),
            'contact_id' => $contact->id,
            'property_id' => $property->id,
            'agent_id' => $contact->assigned_agent_id,
            'status' => $status,
            'commission_rate' => fake()->randomElement([2.5, 1.5]),
            'created_at' => $date = fake()->dateTimeBetween(now()->subDays($startInDays), now()),
            'status_updated_at' => $date,
            'closed_at' => $status === DealStatus::WON ? $date : null,
        ];
    }
}
