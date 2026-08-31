<?php

namespace App\Observers;

use App\Models\Deal;

class DealObserver
{
    public function creating(Deal $deal): void
    {
        if ($deal->status_updated_at === null) {
            $deal->status_updated_at = $deal->created_at ?? now('UTC');
        }
    }

    public function updating(Deal $deal): void
    {
        if ($deal->isDirty('status')) {
            $deal->status_updated_at = now('UTC');
        }
    }
}
