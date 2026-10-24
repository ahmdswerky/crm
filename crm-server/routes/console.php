<?php

use Illuminate\Support\Facades\Schedule;

// hourly commission auditing
Schedule::command('commission:recalculate --all')->hourly()->withoutOverlapping();

Schedule::command('analytics:dispatch-due')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('analytics:prune-reports')->dailyAt('01:00')->timezone('UTC')->withoutOverlapping();
Schedule::command('payments:publish')->everyMinute()->withoutOverlapping();

// prune outdated telescope records (1 week)
Schedule::command('telescope:prune --hours=168')->daily();

// public demo: wipe uploads and reseed nightly
Schedule::command('demo:reset')->dailyAt('03:00')->timezone('UTC')->withoutOverlapping()->when(fn () => config('crm.demo'));
