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

        if (! User::whereEmail($email = 'm.hassan.agent@crm.io')->exists()) {
            User::factory()->create([
                'email' => $email,
                'name' => 'Maya Hassan',
                'username' => 'm.hassan',
            ]);
        }

        if (! User::whereEmail($email = 'o.khalil.agent@crm.io')->exists()) {
            User::factory()->create([
                'email' => $email,
                'name' => 'Omar Khalil',
                'username' => 'o.khalil',
            ]);
        }

        if (! User::whereEmail($email = 'l.adel.agent@crm.io')->exists()) {
            User::factory()->create([
                'email' => $email,
                'name' => 'Lina Adel',
                'username' => 'l.adel',
            ]);
        }

        if (! User::whereEmail($email = 'k.nassar.agent@crm.io')->exists()) {
            User::factory()->create([
                'email' => $email,
                'name' => 'Karim Nassar',
                'username' => 'k.nassar',
            ]);
        }

        if (! User::whereEmail($email = 'n.samir.agent@crm.io')->exists()) {
            User::factory()->create([
                'email' => $email,
                'name' => 'Nour Samir',
                'username' => 'n.samir',
            ]);
        }
    }
}
