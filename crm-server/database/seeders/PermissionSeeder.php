<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
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
        $guard = Guard::getDefaultName(User::class);
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

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
