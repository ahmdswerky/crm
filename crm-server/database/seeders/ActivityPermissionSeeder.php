<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Guard;
use Spatie\Permission\PermissionRegistrar;

class ActivityPermissionSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['view', 'create', 'edit', 'manage'] as $action) {
            Permission::findOrCreate('activity.'.$action, Guard::getDefaultName(User::class));
        }
        foreach (['agent', 'manager'] as $name) {
            $permissions = ['activity.view', 'activity.create', 'activity.edit'];
            if ($name === 'manager') {
                $permissions[] = 'activity.manage';
            }
            Role::query()->where('name', $name)->where('guard_name', Guard::getDefaultName(User::class))
                ->first()?->givePermissionTo($permissions);
        }
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
