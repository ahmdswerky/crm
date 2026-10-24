<?php

use App\Http\Controllers\MediaController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('media')->name('media.')->group(function () {
    Route::get('', [MediaController::class, 'index'])->name('index');
    Route::post('', [MediaController::class, 'store'])->middleware('throttle:20,1')->name('store');
    Route::delete('{media}', [MediaController::class, 'destroy'])->name('destroy');
    Route::post('reorder', [MediaController::class, 'reorder'])->name('reorder');
});
