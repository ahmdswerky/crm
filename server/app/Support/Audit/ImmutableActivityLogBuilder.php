<?php

namespace App\Support\Audit;

use Illuminate\Database\Eloquent\Builder;
use LogicException;

class ImmutableActivityLogBuilder extends Builder
{
    public function delete()
    {
        throw new LogicException('Activity logs are immutable and cannot be deleted.');
    }

    public function forceDelete()
    {
        throw new LogicException('Activity logs are immutable and cannot be force deleted.');
    }
}
