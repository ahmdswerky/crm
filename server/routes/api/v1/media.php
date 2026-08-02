<?php

use App\Http\Controllers\MediaController;
use Illuminate\Support\Facades\Route;

Route::get('media', [MediaController::class, 'index'])->middleware('auth:sanctum');
Route::post('media', [MediaController::class, 'store'])->middleware('auth:sanctum');
Route::post('media/reorder', [MediaController::class, 'reorder'])->middleware('auth:sanctum');
Route::delete('media/{media}', [MediaController::class, 'destroy'])->middleware('auth:sanctum');
