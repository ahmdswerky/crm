<?php

namespace Database\Seeders;

use App\Models\Lead;
use Illuminate\Database\Seeder;

class LeadSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Lead::factory()
            ->pending()
            ->count(10)
            ->create();

        Lead::factory()
            ->contacted()
            ->count(10)
            ->create();

        Lead::factory()
            ->pending()
            ->assigned()
            ->count(100)
            ->create();

        Lead::factory()
            ->unqualified()
            ->count(10)
            ->create();
    }
}
