<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Support\Collection;

class HelperController extends Controller
{
    protected Collection $users;

    public function __construct()
    {
        $this->users = collect();
    }

    public function loginUsers()
    {
        $users = User::query()
            ->without('roles.permissions')
            ->select(['id', 'username', 'is_super'])
            ->with(['roles' => fn ($query) => $query->select('roles.id', 'roles.name')])
            ->whereNot('email', config('app.dev_email'))
            ->get()
            ->sortBy(function (User $user): array {
                $priority = $user->is_super ? 0 : ($user->roles->contains('name', 'manager') ? 1 : 2);

                return [$priority, strtolower((string) $user->username)];
            })
            ->map(fn (User $user): array => [
                'username' => $user->username,
                'role' => $user->roles->first()?->name,
                'is_super' => (bool) $user->is_super,
            ])
            ->values();

        return response()->json($users)
            ->header('Cache-Control', 'no-store');
    }
}
