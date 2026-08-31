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
                        ->whereLike('name', "%{$search}%")
                        ->orWhereLike('industry', "%{$search}%")
                        ->orWhereLike('phone', "%{$search}%")
                        ->orWhereLike('address', "%{$search}%");
                });
            })
            ->when($filters['industry'] ?? null, fn (Builder $query, string $industry) => $query->whereLike('industry', "%{$industry}%"))
            ->when($filters['phone'] ?? null, fn (Builder $query, string $phone) => $query->whereLike('phone', "%{$phone}%"))
            ->when($filters['address'] ?? null, fn (Builder $query, string $address) => $query->whereLike('address', "%{$address}%"))
            ->when($filters['created_from'] ?? null, fn (Builder $query, string $from) => $query->whereDate('created_at', '>=', $from))
            ->when($filters['created_to'] ?? null, fn (Builder $query, string $to) => $query->whereDate('created_at', '<=', $to))
            ->with('media')
            ->withCount('contacts')
            ->orderBy('contacts_count', 'desc')
            ->paginate();
    }

    public function findById(int $id): ?Account
    {
        return $this->model
            ->query()
            ->with('media')
            ->findOrFail($id);
    }

    public function findOrCreateByName(string $name): Account
    {
        return $this->model
            ->query()
            ->firstOrCreate([
                'name' => $name,
            ]);
    }

    public function store(array $data): Account
    {
        return $this->model
            ->query()
            ->create([
                'name' => $data['name'],
                'industry' => $data['industry'] ?? null,
                'phone' => $data['phone'],
                'address' => $data['address'] ?? null,
            ])
            ->load('media');
    }

    public function update(Account $account, array $data): Account
    {
        $account->update([
            'name' => Arr::get($data, 'name', $account->name),
            'industry' => Arr::get($data, 'industry', $account->industry),
            'phone' => Arr::get($data, 'phone', $account->phone),
            'address' => Arr::get($data, 'address', $account->address),
        ]);

        return $account->fresh()->load('media');
    }

    public function delete(int $id): bool
    {
        return (bool) $this->model->destroy($id);
    }
}
