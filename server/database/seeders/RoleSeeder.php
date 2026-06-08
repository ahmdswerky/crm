<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    // use WithoutModelEvents;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $manager = Role::create([
            'name' => 'manager',
            'guard_name' => config('auth.defaults.guard'),
        ]);

        $manager->syncPermissions([
            'user.view', 'user.create', 'user.edit',
            'lead.view', 'lead.create', 'lead.edit',
        ]);

        User::query()
            ->where('email', 'supervisor@crm.io')
            ->first()
            ->assignRole('manager');

        // ---- //

        $agent = Role::create([
            'name' => 'agent',
            'guard_name' => config('auth.defaults.guard'),
        ]);

        $agent->syncPermissions([
            'user.view',
            'lead.view',
        ]);

        User::query()
            ->where('email', 'like', '%.agent@crm.io')
            ->get()
            ->map(fn (User $user) => $user->assignRole('agent'));
    }
}
