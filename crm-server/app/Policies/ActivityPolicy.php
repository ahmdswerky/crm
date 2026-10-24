<?php

namespace App\Policies;

use App\Models\Activity;
use App\Models\User;
use App\Services\Activities\ActivityAccess;

class ActivityPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('activity.view');
    }

    public function view(User $user, Activity $activity): bool
    {
        return $this->viewAny($user) && app(ActivityAccess::class)->visible($user, $activity);
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user) && $user->can('activity.create');
    }

    public function update(User $user, Activity $activity): bool
    {
        return $this->view($user, $activity) && $activity->status !== 'voided'
            && ($user->can('activity.manage') || ($user->can('activity.edit')
                && in_array($user->id, [$activity->creator_id, $activity->assignee_id], true)));
    }

    public function reassign(User $user, Activity $activity): bool
    {
        return $this->update($user, $activity) && ($user->id === $activity->creator_id || $user->can('activity.manage'));
    }
}
