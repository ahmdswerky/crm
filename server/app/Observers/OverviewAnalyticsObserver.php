<?php

namespace App\Observers;

use App\Services\OverviewAnalyticsService;
use Illuminate\Database\Eloquent\Model;

class OverviewAnalyticsObserver
{
    public function saved(Model $model): void
    {
        $this->forget();
    }

    public function deleted(Model $model): void
    {
        $this->forget();
    }

    public function restored(Model $model): void
    {
        $this->forget();
    }

    private function forget(): void
    {
        app(OverviewAnalyticsService::class)->forgetAll();
    }
}
