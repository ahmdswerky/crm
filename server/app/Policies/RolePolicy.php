<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\User;

class RolePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_super;
    }

    public function view(User $user, Role $role): bool
    {
        return $user->is_super;
    }

    public function create(User $user): bool
    {
        return $user->is_super;
    }

    public function update(User $user, Role $role): bool
    {
        return $user->is_super;
    }

    public function delete(User $user, Role $role): bool
    {
        return $user->is_super;
    }

    public function restore(User $user, Role $role): bool
    {
        return $user->is_super;
    }

    public function forceDelete(User $user, Role $role): bool
    {
        return false;
    }
}
