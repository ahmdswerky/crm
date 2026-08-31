<?php

namespace App\Models;

use App\Support\Audit\ImmutableActivityLogBuilder;
use LogicException;
use Spatie\Activitylog\Models\Activity as BaseActivity;

class ActivityLog extends BaseActivity
{
    public function newEloquentBuilder($query)
    {
        return new ImmutableActivityLogBuilder($query);
    }

    public function delete()
    {
        throw new LogicException('Activity logs are immutable and cannot be deleted.');
    }

    public function deleteQuietly()
    {
        throw new LogicException('Activity logs are immutable and cannot be deleted.');
    }

    public function forceDelete()
    {
        throw new LogicException('Activity logs are immutable and cannot be force deleted.');
    }

    public function forceDeleteQuietly()
    {
        throw new LogicException('Activity logs are immutable and cannot be force deleted.');
    }
}
