<?php

use App\Http\Controllers\ActivityLogController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('activity-logs', [ActivityLogController::class, 'index']);
    Route::get('activity-logs/{activityLog}', [ActivityLogController::class, 'show']);
    Route::post('activity-logs/{activityLog}/revert', [ActivityLogController::class, 'revert']);
});
