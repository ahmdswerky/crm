<?php

use App\Http\Controllers\AnalyticsController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('analytics')->controller(AnalyticsController::class)->group(function (): void {
    Route::get('overview', 'overview');
    Route::get('metrics', 'metrics');
    Route::get('leaderboard', 'leaderboard');
    Route::get('revenue', 'revenue');
    Route::get('customers', 'customers');
    Route::get('deals', 'deals');
    Route::get('accounts', 'accounts');
    Route::get('properties', 'properties');
    Route::get('reports', 'reports');
    Route::get('reports/{reportRun}', 'showReport');
    Route::get('reports/{reportRun}/download', 'downloadReport');
});
