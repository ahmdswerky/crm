<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use Spatie\Permission\PermissionRegistrar;
use Spatie\Permission\Guard;
use Illuminate\Support\Str;
use Spatie\Permission\Guard;
use Spatie\Permission\PermissionRegistrar;

class PermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $actions = ['view', 'create', 'edit', 'delete', 'restore'];
<<<<<<< HEAD:crm-server/database/seeders/PermissionSeeder.php
        $guard = Guard::getDefaultName(User::class);
=======
	$guard = Guard::getDefaultName(User::class);
>>>>>>> origin/stage:server/database/seeders/PermissionSeeder.php
        $names = collect(scandir(app_path('Models')))
            ->reject(fn ($name) => in_array($name, ['.', '..', 'ActivityLog.php', 'Permission.php', 'ReportRun.php']))
            ->map(function (string $name) use ($actions) {
                $namespace = Str::of($name)
                    ->chopEnd('.php')
                    ->lower()
                    ->toString();

                return collect($actions)
                    ->map(fn ($action) => implode('.', [$namespace, $action]))
                    ->toArray();
            })
            ->flatten()
            ->map(fn ($permission) => ['name' => $permission, 'guard_name' => config('auth.defaults.guard')])
            ->concat([
                ['name' => 'activity-log.view', 'guard_name' => config('auth.defaults.guard')],
                ['name' => 'activity-log.revert', 'guard_name' => config('auth.defaults.guard')],
                ['name' => 'report.view', 'guard_name' => config('auth.defaults.guard')],
            ])
            ->toArray();

        DB::table(config('permission.table_names.permissions'))
            ->insertOrIgnore($names);

<<<<<<< HEAD:crm-server/database/seeders/PermissionSeeder.php
        app(PermissionRegistrar::class)->forgetCachedPermissions();
=======
	app(PermissionRegistrar::class)->forgetCachedPermissions();
>>>>>>> origin/stage:server/database/seeders/PermissionSeeder.php
    }
}
