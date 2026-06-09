<?php

use App\Http\Controllers\PropertyController;
use Illuminate\Support\Facades\Route;

Route::apiResource('properties', PropertyController::class)
    ->middleware('auth:sanctum');
