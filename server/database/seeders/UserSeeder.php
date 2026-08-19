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

        if (! User::whereEmail($email = config('app.dev_email'))->exists()) {
            User::factory()->create([
                'name' => 'Developer',
                'username' => 'dev',
                'is_super' => true,
                'email' => $email,
            ]);
        }

        $superviros1 = User::whereEmail($email = 'michael@crm.io')->first();

        if (! $superviros1) {
            $superviros1 = User::factory()->create([
                'name' => 'Michael Smith',
                'username' => 'michael',
                'email' => $email,
            ]);
        }

        $superviros2 = User::whereEmail($email = 'chris@crm.io')->first();

        if (! $superviros2) {
            $superviros2 = User::factory()->create([
                'name' => 'Chris Anderson',
                'username' => 'chris',
                'email' => $email,
            ]);
        }

        if (! User::whereEmail($email = 'j.ryan.agent@crm.io')->exists()) {
            User::factory()->create([
                'email' => $email,
                'name' => 'Jack Ryan',
                'username' => 'j.ryan',
                'direct_manager_id' => $superviros1->id,
            ]);
        }

        if (! User::whereEmail($email = 'm.hassan.agent@crm.io')->exists()) {
            User::factory()->create([
                'email' => $email,
                'name' => 'Maya Hassan',
                'username' => 'm.hassan',
                'direct_manager_id' => $superviros1->id,
            ]);
        }

        if (! User::whereEmail($email = 'o.khalil.agent@crm.io')->exists()) {
            User::factory()->create([
                'email' => $email,
                'name' => 'Omar Khalil',
                'username' => 'o.khalil',
                'direct_manager_id' => $superviros1->id,
            ]);
        }

        if (! User::whereEmail($email = 'l.adel.agent@crm.io')->exists()) {
            User::factory()->create([
                'email' => $email,
                'name' => 'Lina Adel',
                'username' => 'l.adel',
                'direct_manager_id' => $superviros2->id,
            ]);
        }

        if (! User::whereEmail($email = 'k.nassar.agent@crm.io')->exists()) {
            User::factory()->create([
                'email' => $email,
                'name' => 'Karim Nassar',
                'username' => 'k.nassar',
                'direct_manager_id' => $superviros2->id,
            ]);
        }

        if (! User::whereEmail($email = 'n.samir.agent@crm.io')->exists()) {
            User::factory()->create([
                'email' => $email,
                'name' => 'Nour Samir',
                'username' => 'n.samir',
                'direct_manager_id' => $superviros2->id,
            ]);
        }
    }
}
