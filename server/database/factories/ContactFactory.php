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

        $accountId = $lead->company_name && Account::query()->where('name', $lead->company_name)->exists() ?
            Account::query()->where('name', $lead->company_name)->value('id') :
            Account::factory()->create(['name' => $lead->company_name])->id;

        return [
            'name' => $lead->name,
            'title' => fake()->randomElement([fake()->jobTitle(), null]),
            'email' => $lead->email,
            'phone' => $lead->phone,
            'account_id' => $accountId,
            'lead_id' => $lead->id,
            'assigned_agent_id' => $lead->assigned_agent_id,
        ];
    }
}
