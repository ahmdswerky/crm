<?php

namespace App\Contracts\Repositories;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface UserRepositoryInterface
{
    public function paginate(): LengthAwarePaginator;

    public function findById(int $id, array $with = []): ?User;

    public function findByEmail(string $email, array $with = []): ?User;

    public function findByUsername(string $username, array $with = []): ?User;

    public function store(array $data): User;

    public function update(User $user, array $data): User;

    public function updatePassword(User $user, string $currentPassword, string $newPassword): bool;

    public function delete(int $id): bool;
}
