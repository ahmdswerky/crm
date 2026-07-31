<?php

use App\Http\Controllers\RoleController;
use Illuminate\Support\Facades\Route;

Route::apiResource('roles', RoleController::class)
    ->middleware('auth:sanctum');
