<?php

namespace App\Repositories;

use App\Contracts\Repositories\AccountRepositoryInterface;
use App\Models\Account;
use Arr;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class AccountRepository implements AccountRepositoryInterface
{
    public function __construct(protected readonly Account $model) {}

    public function paginate(array $filters = []): LengthAwarePaginator
    {
        return $this->model
            ->query()
            ->when($filters['q'] ?? null, function (Builder $query, string $search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('industry', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('address', 'like', "%{$search}%");
                });
            })
            ->when($filters['industry'] ?? null, fn (Builder $query, string $industry) => $query->where('industry', 'like', "%{$industry}%"))
            ->when($filters['phone'] ?? null, fn (Builder $query, string $phone) => $query->where('phone', 'like', "%{$phone}%"))
            ->when($filters['address'] ?? null, fn (Builder $query, string $address) => $query->where('address', 'like', "%{$address}%"))
            ->when($filters['created_from'] ?? null, fn (Builder $query, string $from) => $query->whereDate('created_at', '>=', $from))
            ->when($filters['created_to'] ?? null, fn (Builder $query, string $to) => $query->whereDate('created_at', '<=', $to))
            ->paginate();
    }

    public function find(int $id): ?Account
    {
        return $this->model
            ->query()
            ->findOrFail($id);
    }

    public function store(array $data): Account
    {
        return $this->model
            ->query()
            ->create([
                'name' => $data['name'],
                'industry' => $data['industry'],
                'phone' => $data['phone'],
                'address' => $data['address'],
            ]);
    }

    public function update(Account $account, array $data): Account
    {
        $account->update([
            'name' => Arr::get($data, 'name', $account->name),
            'industry' => Arr::get($data, 'industry', $account->industry),
            'phone' => Arr::get($data, 'phone', $account->phone),
            'address' => Arr::get($data, 'address', $account->address),
        ]);

        return $account->fresh();
    }

    public function delete(int $id): bool
    {
        return (bool) $this->model->destroy($id);
    }
}
