<?php

namespace Database\Factories;

use App\Enums\PropertyPurpose;
use App\Enums\PropertyStatus;
use App\Enums\PropertyType;
use App\Models\Property;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Property>
 */
class PropertyFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'created_by' => 2, // supervisor id
            'title' => fake()->unique()->sentence(2),
            'description' => fake()->words(15, true),
            'price' => fake()->numberBetween(1, 10) * 100000,
            'city' => fake()->city(),
            'address' => fake()->streetAddress(),
            'status' => fake()->randomElement(PropertyStatus::cases()),
            // 'purpose' => fake()->randomElement(PropertyPurpose::cases()),
            'type' => fake()->randomElement(PropertyType::cases()),
        ];
    }
}
