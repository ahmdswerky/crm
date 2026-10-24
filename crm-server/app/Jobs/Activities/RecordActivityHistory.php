<?php

namespace App\Jobs\Activities;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

class RecordActivityHistory implements ShouldQueue
{
    use Queueable;

    public $tries = 5;

    public function __construct(public readonly int $eventId) {}

    public function handle(): void
    {
        // The durable event retains the snapshot; this projection is retry safe.
        DB::table('activity_history_entries')->insertOrIgnore([
            'activity_event_id' => $this->eventId,
            'recorded_at' => now(),
        ]);
    }
}
