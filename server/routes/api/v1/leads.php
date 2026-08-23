<?php

use App\Enums\LeadStatus;
use App\Http\Controllers\LeadController;
use Illuminate\Support\Facades\Route;

Route::get('leads/board', [LeadController::class, 'board'])
    ->middleware('auth:sanctum');
Route::get('leads/board/{status}', [LeadController::class, 'boardColumn'])
    ->whereIn('status', array_map(fn (LeadStatus $status) => $status->value, LeadStatus::cases()))
    ->middleware('auth:sanctum');

Route::apiResource('leads', LeadController::class)
    ->middleware('auth:sanctum');
