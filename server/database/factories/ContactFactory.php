<?php

namespace Database\Factories;

use App\Enums\LeadStatus;
use App\Models\Account;
use App\Models\Contact;
use App\Models\Lead;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Contact>
 */
class ContactFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $lead = Lead::query()
            ->pending()
            ->assigned()
            ->doesntHave('contact')
            ->inRandomOrder()
            ->first();

        return [
            'name' => fake()->name(),
            'title' => fake()->randomElement([fake()->jobTitle(), null]),
            'email' => fake()->randomElement([fake()->unique()->safeEmail(), null]),
            'phone' => fake()->unique()->e164PhoneNumber(),
            'account_id' => Account::query()->inRandomOrder()->value('id'),
            'lead_id' => $lead->id,
            'assigned_agent_id' => $lead->assigned_agent_id,
        ];
    }
}
