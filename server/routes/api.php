<?php

use Illuminate\Support\Facades\Route;

Route::group([], fn () => require_once (base_path('routes/api/auth.php')));

Route::prefix('v1')->group(fn () => require_once (base_path('routes/api/v1/users.php')));
