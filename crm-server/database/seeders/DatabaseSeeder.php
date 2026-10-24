<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            PermissionSeeder::class,
            RoleSeeder::class,
            CommissionPolicySeeder::class,
        ]);

        $this->call([
            AccountSeeder::class,
            LeadSeeder::class,
            PropertySeeder::class,
            ContactSeeder::class,
            DealSeeder::class,
            ActivitySeeder::class,
            PropertyMediaSeeder::class,
        ]);
    }
}
