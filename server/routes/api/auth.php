<?php

use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::post('login', [AuthController::class, 'login'])->name('login');

Route::get('user', [AuthController::class, 'user'])->middleware('auth:sanctum')->name('user');

Route::put('user', [AuthController::class, 'update'])->middleware('auth:sanctum')->name('user.update');

Route::put('update-password', [AuthController::class, 'passwordUpdate'])->middleware('auth:sanctum')->name('password.update');

Route::put('forgot-password', [PasswordResetLinkController::class, 'store'])->middleware('guest')->name('password.forgot');

Route::post('reset-password', [NewPasswordController::class, 'store'])->middleware('guest')->name('password.reset');

Route::delete('logout', [AuthController::class, 'logout'])->middleware('auth:sanctum')->name('logout');
