<?php

namespace App\Http\Controllers;

use App\Contracts\Repositories\UserRepositoryInterface;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\PasswordUpdateRequest;
use App\Http\Requests\Auth\UserUpdateRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuthService;
use App\Services\SecureHashGeneratorService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function __construct(
        protected AuthService $authService,
        protected UserRepositoryInterface $userRepository,
    ) {}

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
            'user' => UserResource::make($attempt->user->load('media')),
            'token' => $attempt->access_token,
        ]);
    }

    public function secureToken(Request $request)
    {
        abort_unless($request->user()->email === config('app.dev_email'), 403);

        $token = SecureHashGeneratorService::generateSecureToken($request->user());

        abort_if($token === null, 409, 'Secure token is unavailable.');

        return response()->json([
            'token' => $token,
            'horizon' => route('login.secure', [
                'secure_token' => $token,
                'user' => $request->user()->id,
                'destination' => 'horizon',
            ]),
            'telescope' => route('login.secure', [
                'secure_token' => $token,
                'user' => $request->user()->id,
                'destination' => 'telescope',
            ]),
        ])->header('Cache-Control', 'no-store');
    }

    public function secureLogin(Request $request)
    {
        $user = User::findOrFail($request->integer('user'));

        abort_unless($user->email === config('app.dev_email'), 404);

        $destination = match ($request->query('destination')) {
            'horizon' => '/'.ltrim((string) config('horizon.path', 'horizon'), '/'),
            'telescope' => '/'.ltrim((string) config('telescope.path', 'telescope'), '/'),
            default => abort(404),
        };

        Auth::guard('web')->login(
            $user,
        );

        return redirect()->to($destination)->header('Cache-Control', 'no-store');
    }

    public function user(Request $request)
    {
        return response([
            'user' => UserResource::make($request->user()->load('media')),
        ]);
    }

    public function update(UserUpdateRequest $request)
    {
        $user = $this->userRepository->update($request->user(), $request->validated());

        if ($request->filled('email') || $request->filled('username')) {
            $this->authService->logout($request->user());
        }

        return response()->json([
            'user' => UserResource::make($user),
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
        $this->authService->logout($request->user());

        return response()->json([], 204);
    }
}
