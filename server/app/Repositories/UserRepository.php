<?php

namespace App\Repositories;

use App\Contracts\Repositories\UserRepositoryInterface;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class UserRepository implements UserRepositoryInterface
{
    public function __construct(protected readonly User $model) {}

    public function paginate(): LengthAwarePaginator
    {
        return $this->model
            ->query()
            ->paginate();
    }

    public function findById(int $id, array $with = []): ?User
    {
        return $this->model
            ->with($with)
            ->findOrFail($id);
    }

    public function findByEmail(string $email, array $with = []): ?User
    {
        return $this->model
            ->query()
            ->where('email', $email)
            ->with($with)
            ->firstOrFail();
    }

    public function findByUsername(string $username, array $with = []): ?User
    {
        return $this->model
            ->query()
            ->where('email', $username)
            ->orWhere('username', $username)
            ->with($with)
            ->firstOrFail();
    }

    public function store(array $data): User
    {
        return $this->model->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'username' => Str::of($data['username'])->slug('.')->lower()->toString(),
            'phone' => $data['phone'],
            'password' => $data['password'],
        ]);
    }

    public function update(User $user, array $data): User
    {
        $user->update([
            'name' => Arr::get($data, 'name', $user->name),
            'username' => Arr::get($data, 'username', $user->username),
            'email' => Arr::get($data, 'email', $user->email),
            'phone' => Arr::get($data, 'phone', $user->phone),
        ]);

        if (array_key_exists('roles', $data) && is_array($data['roles'])) {
            $user->syncRoles($data['roles']);
        }

        return $user->fresh(['roles.permissions']);
    }

    public function updatePassword(User $user, string $currentPassword, string $newPassword): bool
    {
        $checked = $user->checkPassword($currentPassword);

        if (! $checked) {
            return false;
        }

        return $user->update([
            'password' => $newPassword,
        ]);
    }

    public function delete(int $id): bool
    {
        return (bool) $this->model->destroy($id);
    }
}
