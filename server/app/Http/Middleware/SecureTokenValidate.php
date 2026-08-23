<?php

namespace App\Http\Middleware;

use App\Services\SecureHashGeneratorService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecureTokenValidate
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->query('secure_token');

        abort_if(is_null($token), 404);

        $valid = SecureHashGeneratorService::validateSecureToken(
            (int) $request->query('user'),
            $token,
        );

        abort_if(! $valid, 404);

        return $next($request);
    }
}
