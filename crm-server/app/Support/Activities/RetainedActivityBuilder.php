<?php

namespace App\Support\Activities;

use Illuminate\Database\Eloquent\Builder;
use LogicException;

class RetainedActivityBuilder extends Builder
{
    public function delete()
    {
        throw new LogicException('Activity history cannot be deleted.');
    }

    public function forceDelete()
    {
        throw new LogicException('Activity history cannot be deleted.');
    }
}
