<?php

use App\Http\Controllers\MediaController;
use Illuminate\Support\Facades\Route;

Route::prefix('media')->name('media.')->group(function () {
    Route::apiResource('', MediaController::class)->only(['index', 'store', 'delete']);
    Route::post('reorder', [MediaController::class, 'reorder'])->name('reorder');
})->middleware('auth:sanctum');
