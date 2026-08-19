<?php

namespace App\Repositories;

use App\Contracts\Repositories\RoleRepositoryInterface;
use App\Models\Role;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;

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
                'guard_name' => config('auth.defaults.guard'),
            ]);

        if (array_key_exists('permissions', $data)) {
            $role->syncPermissions($data['permissions']);
        }

        return $role->load('permissions');
    }

    public function update(Role $role, array $data): ?Role
    {
        $role->update([
            'name' => Arr::get($data, 'name', $role->name),
        ]);

        if (array_key_exists('permissions', $data)) {
            $role->syncPermissions($data['permissions']);
        }

        return $role->fresh('permissions');
    }

    public function delete(int $id): bool
    {
        return (bool) $this->model->destroy($id);
    }
}
