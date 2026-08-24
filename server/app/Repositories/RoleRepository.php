<?php

namespace App\Repositories;

use App\Contracts\Repositories\RoleRepositoryInterface;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;
use Spatie\Permission\Guard;

class RoleRepository implements RoleRepositoryInterface
{
    public function __construct(protected Role $model) {}

    public function paginate(): LengthAwarePaginator
    {
        return $this->model
            ->query()
            ->withCount('permissions')
            ->paginate();
    }

    public function find(int $id): Role
    {
        return $this->model
            ->query()
            ->with('permissions')
            ->findOrFail($id);
    }

    public function store(array $data): Role
    {
        $role = $this->model
            ->query()
            ->create([
                'name' => $data['name'],
                'guard_name' => Guard::getDefaultName(User::class),
            ]);

        if (array_key_exists('permissions', $data)) {
            $role->syncPermissions($this->permissionsForRole($role, $data['permissions']));
        }

        return $role->load('permissions');
    }

    public function update(Role $role, array $data): ?Role
    {
        $role->update([
            'name' => Arr::get($data, 'name', $role->name),
        ]);

        if (array_key_exists('permissions', $data)) {
            $role->syncPermissions($this->permissionsForRole($role, $data['permissions']));
        }

        return $role->fresh('permissions');
    }

    public function delete(int $id): bool
    {
        return (bool) $this->model->destroy($id);
    }

    /** @param array<int, string> $names */
    private function permissionsForRole(Role $role, array $names): array
    {
        return collect($names)
            ->map(fn (string $name): Permission => Permission::findByName($name, $role->guard_name))
            ->all();
    }
}
