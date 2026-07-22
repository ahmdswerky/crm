<?php

namespace App\Policies;

use App\Models\Deal;
use App\Models\User;

class DealPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('deal.view');
    }

    public function view(User $user, Deal $deal): bool
    {
        return $user->can('deal.view');
    }

    public function create(User $user): bool
    {
        return $user->can('deal.create');
    }

    public function update(User $user, Deal $deal): bool
    {
        return $user->can('deal.edit');
    }

    public function delete(User $user, Deal $deal): bool
    {
        return $user->can('deal.delete');
    }

    public function restore(User $user, Deal $deal): bool
    {
        return $user->can('deal.restore');
    }

    public function forceDelete(User $user, Deal $deal): bool
    {
        return $user->is_super;
    }
}
