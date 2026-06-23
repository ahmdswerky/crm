<?php

use Illuminate\Support\Facades\Route;

Route::group([], fn () => require_once (base_path('routes/api/auth.php')));

Route::prefix('v1')->group(function () {
    require_once base_path('routes/api/v1/users.php');

    require_once base_path('routes/api/v1/leads.php');

    require_once base_path('routes/api/v1/properties.php');

    require_once base_path('routes/api/v1/accounts.php');

    require_once base_path('routes/api/v1/contacts.php');

});
