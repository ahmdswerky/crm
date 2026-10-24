<?php

namespace App\Console\Commands;

use App\Jobs\Activities\RecordActivityHistory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RecordPendingActivityHistory extends Command
{
    protected $signature = 'activities:record-pending';

    protected $description = 'Queue unrecorded sales interaction history';

    public function handle(): int
    {
        DB::table('activity_events')->whereNotExists(fn ($q) => $q->selectRaw('1')
            ->from('activity_history_entries')->whereColumn('activity_event_id', 'activity_events.id'))
            ->orderBy('id')->chunkById(100, function ($events): void {
                foreach ($events as $event) {
                    RecordActivityHistory::dispatch($event->id);
                }
            });

        return self::SUCCESS;
    }
}
