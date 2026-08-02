<?php

namespace App\Repositories;

use App\Contracts\Repositories\UserRepositoryInterface;
use App\Models\User;
use App\Services\AuditEventLogger;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class UserRepository implements UserRepositoryInterface
{
    public function __construct(
        protected readonly User $model,
        private readonly AuditEventLogger $auditEvents,
    ) {}

    public function paginate(array $filters = []): LengthAwarePaginator
    {
        $isSuperAdmin = (bool) request()->user()->is_super;

        return $this->model
            ->query()
            ->with('media')
            ->when(! $isSuperAdmin, fn (Builder $query) => $query->where('is_super', false))
            ->when($filters['q'] ?? null, function (Builder $query, string $search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('username', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhereHas('roles', fn (Builder $query) => $query->where('name', 'like', "%{$search}%"));
                });
            })
            ->when($filters['role'] ?? null, fn (Builder $query, string $role) => $query->whereHas('roles', fn (Builder $query) => $query->where('name', $role)))
            ->when($filters['access'] ?? null, fn (Builder $query, string $access) => $query->where('is_super', $access === 'super'))
            ->when($filters['permission'] ?? null, fn (Builder $query, string $permission) => $query->whereHas('permissions', fn (Builder $query) => $query->where('name', $permission)))
            ->when($filters['created_from'] ?? null, fn (Builder $query, string $from) => $query->whereDate('created_at', '>=', $from))
            ->when($filters['created_to'] ?? null, fn (Builder $query, string $to) => $query->whereDate('created_at', '<=', $to))
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
        $user = $this->model->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'username' => Str::of($data['username'])->slug('.')->lower()->toString(),
            'phone' => $data['phone'],
            'password' => $data['password'],
        ]);

        if (array_key_exists('roles', $data) && is_array($data['roles'])) {
            $user->syncRoles($data['roles']);
            $this->auditEvents->rolesUpdated($user, [], $data['roles']);
        }

        return $user->fresh(['roles.permissions', 'media']);
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
            $beforeRoles = $user->roles->pluck('name')->all();
            $user->syncRoles($data['roles']);
            $this->auditEvents->rolesUpdated($user, $beforeRoles, $data['roles']);
        }

        return $user->fresh(['roles.permissions', 'media']);
    }

    public function updatePassword(User $user, string $currentPassword, string $newPassword): bool
    {
        $checked = $user->checkPassword($currentPassword);

        if (! $checked) {
            return false;
        }

        $updated = $user->update([
            'password' => $newPassword,
        ]);

        if ($updated) {
            $this->auditEvents->passwordUpdated($user);
        }

        return $updated;
    }

    public function delete(int $id): bool
    {
        return (bool) $this->model->destroy($id);
    }
}
