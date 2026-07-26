<?php

namespace App\Policies;

use App\Models\Contact;
use App\Models\User;

class ContactPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('contact.view');
    }

    public function view(User $user, Contact $contact): bool
    {
        return $user->can('contact.view');
    }

    public function create(User $user): bool
    {
        return $user->can('contact.create');
    }

    public function update(User $user, Contact $contact): bool
    {
        return $user->can('contact.edit');
    }

    public function delete(User $user, Contact $contact): bool
    {
        return $user->can('contact.delete');
    }

    public function restore(User $user, Contact $contact): bool
    {
        return $user->can('contact.restore');
    }

    public function forceDelete(User $user, Contact $contact): bool
    {
        return false;
    }
}
