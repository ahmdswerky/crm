<?php

use App\Http\Controllers\DealController;
use Illuminate\Support\Facades\Route;

Route::apiResource('deals', DealController::class)
    ->middleware('auth:sanctum');
