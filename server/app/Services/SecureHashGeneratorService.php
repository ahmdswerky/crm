<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

class SecureHashGeneratorService
{
    public static function generateSecureToken(User|int $user): ?string
    {
        $user = $user instanceof User ? $user : User::select(['id', 'email', 'remember_token', 'is_super'])
            ->find($user);

        if (! $user?->is_super || $user->email !== config('app.dev_email')) {
            return null;
        }

        if (! $user?->getRememberToken()) {
            return null;
        }

        return Hash::make($user->getRememberToken());
    }

    public static function validateSecureToken(User|int $user, string $token): bool
    {
        $user = $user instanceof User ? $user : User::select(['id', 'email', 'remember_token', 'is_super'])
            ->find($user);

        if (! $user?->is_super || $user->email !== config('app.dev_email')) {
            return false;
        }

        if (! $user?->getRememberToken()) {
            return false;
        }

        return Hash::check($user->getRememberToken(), $token);
    }
}
