<?php

use Illuminate\Support\Facades\Route;

Route::group([], fn () => require base_path('routes/api/auth.php'));

Route::prefix('v1')->group(function () {
    require base_path('routes/api/v1/users.php');

    require base_path('routes/api/v1/roles.php');

    require base_path('routes/api/v1/permissions.php');

    require base_path('routes/api/v1/leads.php');

    require base_path('routes/api/v1/properties.php');

    require base_path('routes/api/v1/accounts.php');

    require base_path('routes/api/v1/contacts.php');

    require base_path('routes/api/v1/deals.php');

    require base_path('routes/api/v1/activity-logs.php');

    require base_path('routes/api/v1/media.php');

    require base_path('routes/api/v1/analytics.php');
});
