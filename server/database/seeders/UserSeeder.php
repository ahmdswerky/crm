<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
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

        if (! User::whereEmail($email = 'supervisor@crm.io')->exists()) {
            User::factory()->create([
                'name' => 'Supervisor',
                'username' => 'supervisor',
                'email' => $email,
            ]);
        }

        if (! User::whereEmail($email = 'j.ryan.agent@crm.io')->exists()) {
            User::factory()->create([
                'email' => $email,
                'name' => 'Jack Ryan',
                'username' => 'j.ryan',
            ]);
        }
    }
}
