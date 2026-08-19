<?php

namespace App\Services;

use App\Contracts\Repositories\UserRepositoryInterface;
use App\Models\User;

class AuthService
{
    /**
     * Create a new class instance.
     */
    public function __construct(protected UserRepositoryInterface $userRepository) {}

    public function attempt(string $username, string $password): object|false
    {
        $user = $this->userRepository->findByUsername($username);

        if (! $user) {
            return false;
        }

        if (! $user->checkPassword($password)) {
            return false;
        }

        $token = $user->createToken('login');

        return (object) [
            'user' => $user,
            'access_token' => $token->plainTextToken,
        ];
    }

    public function updatePassword(User $user, string $currentPassword, string $newPassword): bool
    {
        return $this->userRepository->updatePassword(
            $user,
            $currentPassword,
            $newPassword,
        );
    }

    public function logout(User $user): void
    {
        $user->currentAccessToken()?->delete();
    }
}
