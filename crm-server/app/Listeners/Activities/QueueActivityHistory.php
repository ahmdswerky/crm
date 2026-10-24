<?php

namespace App\Listeners\Activities;

use App\Events\Activities\ActivityChanged;
use App\Jobs\Activities\RecordActivityHistory;
use Throwable;

class QueueActivityHistory
{
    public function handle(ActivityChanged $event): void
    {
        try {
            RecordActivityHistory::dispatch($event->eventId)->afterCommit();
        } catch (Throwable $exception) {
            // Recovery retries the durable event if the queue is unavailable.
            report($exception);
        }
    }
}
