<?php

use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

Route::view('/', 'welcome');

Route::get('_health/ready', [HealthController::class, 'ready']);
