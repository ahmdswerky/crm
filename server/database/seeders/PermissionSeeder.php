<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $actions = ['view', 'create', 'edit', 'delete', 'restore'];
        $names = collect(scandir(app_path('Models')))
            ->reject(fn ($name) => in_array($name, ['.', '..', 'Permission.php']))
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
            ->toArray();

        DB::table(config('permission.table_names.permissions'))
            ->insertOrIgnore($names);
    }
}
