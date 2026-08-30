<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Spatie\Permission\Guard;
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
	$guard = Guard::getDefaultName(User::class);
echo $guard . "\n";
        $manager = Role::firstOrCreate([
            'name' => 'manager',
            'guard_name' => $guard,
        ]);

        $manager->syncPermissions([
            // 'role.view', 'role.create', 'role.edit', 'role.delete', 'role.restore',
            'user.view', 'user.create', 'user.edit', 'user.delete',
            'lead.view', 'lead.create', 'lead.edit', 'lead.delete',
            'property.view', 'property.create', 'property.edit', 'property.delete',
            'account.view', 'account.create', 'account.edit', 'account.delete',
            'contact.view', 'contact.create', 'contact.edit', 'contact.delete',
            'deal.view', 'deal.create', 'deal.edit', 'deal.delete',
            'activity-log.view', 'activity-log.revert',
            'report.view',
        ]);

        // Managers Assign
        User::query()
            ->select(['id', 'email'])
            ->whereIn('email', ['michael@crm.io', 'chris@crm.io'])
            ->get()
            ->map
            ->assignRole('manager');

        // ---- //

        $agent = Role::firstOrCreate([
            'name' => 'agent',
            'guard_name' => $guard,
        ]);

        $agent->syncPermissions([
            'user.view',
            'lead.view',
            'property.view',
            'account.view', 'account.create', 'account.edit',
            'contact.view', 'contact.create', 'contact.edit',
            'deal.view', 'deal.create',
            'report.view',
        ]);

        User::query()
            ->whereLike('email', '%.agent@crm.io')
            ->get()
            ->map
            ->assignRole('agent');

        // User::query()
        //     ->where('email', 'owner@crm.io')
        //     ->first()
        //     ->givePermissionTo(['activity-log.view', 'activity-log.revert']);
    }
}
