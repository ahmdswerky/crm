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
        $manager = Role::firstOrCreate([
            'name' => 'manager',
            'guard_name' => config('auth.defaults.guard'),
        ]);

        $manager->syncPermissions([
            'user.view', 'user.create', 'user.edit', 'user.delete',
            'lead.view', 'lead.create', 'lead.edit', 'lead.delete',
            'property.view', 'property.create', 'property.edit', 'property.delete',
            'account.view', 'account.create', 'account.edit', 'account.delete',
            'contact.view', 'contact.create', 'contact.edit', 'contact.delete',
            'deal.view', 'deal.create', 'deal.edit', 'deal.delete',
            'activity-log.view', 'activity-log.revert',
        ]);

        User::query()
            ->where('email', 'supervisor@crm.io')
            ->first()
            ->assignRole('manager');

        // ---- //

        $agent = Role::firstOrCreate([
            'name' => 'agent',
            'guard_name' => config('auth.defaults.guard'),
        ]);

        $agent->syncPermissions([
            'user.view',
            'lead.view',
            'property.view',
            'account.view', 'account.create', 'account.edit',
            'contact.view', 'contact.create', 'contact.edit',
            'deal.view',
        ]);

        User::query()
            ->where('email', 'like', '%.agent@crm.io')
            ->get()
            ->map(fn (User $user) => $user->assignRole('agent'));

        // User::query()
        //     ->where('email', 'owner@crm.io')
        //     ->first()
        //     ->givePermissionTo(['activity-log.view', 'activity-log.revert']);
    }
}
