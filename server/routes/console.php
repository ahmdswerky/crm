<?php

use Illuminate\Support\Facades\Schedule;

// hourly commission auditing
Schedule::command('commission:recalculate --all')->hourly();

Schedule::command('analytics:dispatch-due')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('analytics:prune-reports')->dailyAt('01:00')->timezone('UTC')->withoutOverlapping();

// prune outdated telescope records (1 week)
Schedule::command('telescope:prune --hours=168')->daily();
