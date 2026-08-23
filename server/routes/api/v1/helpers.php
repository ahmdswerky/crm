<?php

use App\Http\Controllers\HelperController;
use Illuminate\Support\Facades\Route;

Route::get('login-users', [HelperController::class, 'loginUsers']);
