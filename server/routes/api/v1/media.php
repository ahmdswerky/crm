<?php

use App\Http\Controllers\MediaController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('media')->name('media.')->group(function () {
    Route::apiResource('', MediaController::class)->only(['index', 'store']);
    Route::delete('{media}', [MediaController::class, 'destroy'])->name('destroy');
    Route::post('reorder', [MediaController::class, 'reorder'])->name('reorder');
});
