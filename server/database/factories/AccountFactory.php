<?php

namespace Database\Factories;

use App\Models\Account;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Account>
 */
class AccountFactory extends Factory
{
    protected $model = Account::class;

    public function definition(): array
    {
        return [
            'name' => fake()->company(),
            'industry' => fake()->randomElement([
                'Development',
                'Hospitality',
                'Utilities',
                'Education',
            ]),
            'phone' => fake()->unique()->e164PhoneNumber(),
            'address' => fake()->streetAddress(),
        ];
    }
}
