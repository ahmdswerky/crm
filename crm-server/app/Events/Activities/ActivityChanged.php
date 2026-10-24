<?php

namespace App\Events\Activities;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

class ActivityChanged implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public readonly int $eventId) {}
}
