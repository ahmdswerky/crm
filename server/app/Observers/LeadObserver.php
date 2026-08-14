<?php

namespace App\Observers;

use App\Enums\LeadStatus;
use App\Jobs\Lead\LeadConvertionJob;
use App\Models\Lead;

class LeadObserver
{
    public function updated(Lead $lead): void
    {
        if (! $lead->wasChanged('status') || $lead->status !== LeadStatus::QUALIFIED) {
            return;
        }

        LeadConvertionJob::dispatch($lead->getKey())->afterCommit();
    }
}
