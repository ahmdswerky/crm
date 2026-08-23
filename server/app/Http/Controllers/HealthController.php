<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Throwable;

class HealthController extends Controller
{
    public function ready()
    {
        try {
            DB::connection()->select('select 1');
            Redis::connection('default')->ping();

            return response()->json(['status' => 'ok']);
        } catch (Throwable) {
            return response()->json(['status' => 'not_ready'], 503);
        }
    }
}
