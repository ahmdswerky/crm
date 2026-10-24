<?php

namespace App\Support\Activities;

use LogicException;

class ImmutableActivityBuilder extends RetainedActivityBuilder
{
    public function update(array $values)
    {
        throw new LogicException('Saved activity history and links are immutable.');
    }
}
