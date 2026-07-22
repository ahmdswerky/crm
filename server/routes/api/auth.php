<?php

use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::post('login', [AuthController::class, 'login'])->name('login');

Route::get('user', [AuthController::class, 'user'])->middleware('auth:sanctum');

Route::put('update-password', [AuthController::class, 'passwordUpdate'])->middleware('auth:sanctum');

Route::put('forgot-password', [PasswordResetLinkController::class, 'store'])->middleware('guest');

Route::post('reset-password', [NewPasswordController::class, 'store'])->middleware('guest');

Route::delete('logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
