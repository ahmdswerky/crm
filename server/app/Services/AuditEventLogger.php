<?php

namespace App\Services;

use App\Models\User;

class AuditEventLogger
{
    public function rolesUpdated(User $user, array $beforeRoles, array $afterRoles): void
    {
        activity('crm')
            ->performedOn($user)
            ->event('roles_updated')
            ->withProperties([
                'before' => ['roles' => array_values($beforeRoles)],
                'after' => ['roles' => array_values($afterRoles)],
            ])
            ->log('updated user roles');
    }

    public function passwordUpdated(User $user): void
    {
        activity('crm')
            ->performedOn($user)
            ->event('password_updated')
            ->log('updated user password');
    }
}
