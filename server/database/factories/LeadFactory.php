<?php

namespace Database\Factories;

use App\Enums\LeadSource;
use App\Enums\LeadStatus;
use App\Models\Account;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Lead>
 */
class LeadFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $startInDays = config('crm.seeds.period.start');
        $companies = [
            'Nike',
            'IKEA',
            'Apple',
            'Google',
            'Uber',
        ];

        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => fake()->unique()->e164PhoneNumber(),
            'status' => fake()->randomElement(LeadStatus::cases()),
            'city' => fake()->city(),
            'address' => fake()->streetAddress(),
            'company_name' => fake()->randomElement($companies),
            'source' => fake()->randomElement(LeadSource::cases()),
            'assigned_agent_id' => function (array $attributes) {
                if (array_key_exists('assigned_agent_id', $attributes) && is_int($attributes['assigned_agent_id'])) {
                    return $attributes['assigned_agent_id'];
                }

                return fake()->randomElement([
                    null,
                    User::query()->agents()->inRandomOrder()->value('id'),
                ]);
            },
            'created_at' => $date = fake()->dateTimeBetween(now()->subDays($startInDays), now()->subDay()),
        ];
    }

    /**
     * Indicate that the model's assigned agent should have value.
     */
    public function assigned(): static
    {
        return $this->state([
            'assigned_agent_id' => User::query()->agents()->inRandomOrder()->value('id'),
        ]);
    }

    /**
     * Indicate that the model's status should be pending.
     */
    public function pending(): static
    {
        return $this->state([
            'status' => LeadStatus::PENDING,
        ]);
    }

    /**
     * Indicate that the model's status should be contacted.
     */
    public function contacted(): static
    {
        return $this->state([
            'status' => LeadStatus::CONTACTED,
        ]);
    }

    /**
     * Indicate that the model's status should be qualified.
     */
    public function qualified(): static
    {
        return $this->state([
            'status' => LeadStatus::QUALIFIED,
        ]);
    }

    /**
     * Indicate that the model's status should be unqualified.
     */
    public function unqualified(): static
    {
        return $this->state([
            'status' => LeadStatus::UNQUALIFIED,
        ]);
    }
}
