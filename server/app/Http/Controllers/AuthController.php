<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\PasswordUpdateRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(protected AuthService $authService) {}

    public function login(LoginRequest $request)
    {
        $attempt = $this->authService->attempt(
            $request->input('username'),
            $request->input('password'),
        );

        if (! $attempt) {
            return response([
                'message' => 'username or password don\'t match our records.',
            ], 401);
        }

        return response()->json([
            'user' => UserResource::make($attempt->user),
            'token' => $attempt->access_token,
        ]);
    }

    public function user(Request $request)
    {
        return response([
            'user' => UserResource::make($request->user()),
        ]);
    }

    public function passwordUpdate(PasswordUpdateRequest $request)
    {
        $updated = $this->authService->updatePassword(
            $request->user(),
            $request->input('current_password'),
            $request->input('new_password'),
        );

        if (! $updated) {
            return response()->json([
                'message' => 'wrong password',
            ]);
        }

        return response()->json([
            'message' => 'password updated',
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        $user->currentAccessToken()->delete();

        return response()->json([], 204);
    }
}
