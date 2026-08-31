<?php

namespace App\Policies;

use App\Models\Account;
use App\Models\User;

class AccountPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('account.view');
    }

    public function view(User $user, Account $account): bool
    {
        return $user->can('account.view');
    }

    public function create(User $user): bool
    {
        return $user->can('account.create');
    }

    public function update(User $user, Account $account): bool
    {
        return $user->can('account.edit');
    }

    public function delete(User $user, Account $account): bool
    {
        return $user->can('account.delete');
    }

    public function restore(User $user, Account $account): bool
    {
        return $user->can('account.restore');
    }

    public function forceDelete(User $user, Account $account): bool
    {
        return $user->is_super;
    }
}
