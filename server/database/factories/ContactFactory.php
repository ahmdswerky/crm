<?php

namespace Database\Factories;

use App\Models\Account;
use App\Models\Contact;
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
        return [
            'name' => fake()->name(),
            'title' => fake()->randomElement([fake()->jobTitle(), null]),
            'email' => fake()->randomElement([fake()->unique()->safeEmail(), null]),
            'phone' => fake()->unique()->e164PhoneNumber(),
            'account_id' => Account::inRandomOrder()->first()->id,
        ];
    }
}
