<?php

use App\Http\Controllers\LeadController;
use Illuminate\Support\Facades\Route;

Route::apiResource('leads', LeadController::class)
    ->middleware('auth:sanctum');
