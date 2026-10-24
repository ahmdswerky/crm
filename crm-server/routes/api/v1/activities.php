<?php

use App\Http\Controllers\ActivityController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('activities/options', [ActivityController::class, 'options']);
    Route::get('activity-history', [ActivityController::class, 'history']);
    Route::apiResource('activities', ActivityController::class)->only(['index', 'store', 'show', 'update']);
});
