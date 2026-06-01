<?php

namespace Database\Seeders;

use App\Models\User;
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
        if (! User::whereEmail($email = 'owner@crm.io')->exists()) {
            User::factory()->create([
                'name' => 'Owner',
                'username' => 'owner',
                'is_super' => true,
                'email' => $email,
            ]);
        }

        $this->call([
            PermissionSeeder::class,
        ]);
    }
}
