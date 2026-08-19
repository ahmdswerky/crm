<?php

namespace App\Contracts\Repositories;

use App\Models\Role;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface RoleRepositoryInterface
{
    public function paginate(): LengthAwarePaginator;

    public function find(int $id): Role;

    public function store(array $data): Role;

    public function update(Role $role, array $data): ?Role;

    public function delete(int $id): bool;
}
