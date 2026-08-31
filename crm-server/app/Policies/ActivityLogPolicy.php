<?php

namespace App\Policies;

use App\Models\ActivityLog;
use App\Models\User;

class ActivityLogPolicy
{
    public function viewAny(User $user): bool
    {
        return $this->hasPermission($user, 'activity-log.view');
    }

    public function view(User $user, ActivityLog $activity): bool
    {
        return $this->viewAny($user);
    }

    public function revert(User $user, ActivityLog $activity): bool
    {
        return $this->viewAny($user) && $this->hasPermission($user, 'activity-log.revert');
    }

    private function hasPermission(User $user, string $permission): bool
    {
        return $user->getAllPermissions()->contains('name', $permission);
    }

    public function delete(User $user, ActivityLog $activity): bool
    {
        return false;
    }

    public function forceDelete(User $user, ActivityLog $activity): bool
    {
        return false;
    }
}
